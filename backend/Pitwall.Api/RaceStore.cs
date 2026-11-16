using System.Collections.Concurrent;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

public sealed class RaceStore
{
    private readonly NpgsqlDataSource? db;
    private readonly ILogger<RaceStore> logger;
    private readonly ConcurrentDictionary<string,string> races = new();
    private readonly Dictionary<Guid,(string SessionId, Bookmark Bookmark)> bookmarks = [];
    private readonly object gate = new();
    public string Storage => db is null ? "snapshot" : "postgresql";

    public RaceStore(IServiceProvider services, ILogger<RaceStore> logger)
    {
        db = services.GetService<NpgsqlDataSource>();
        this.logger = logger;
        foreach (var file in Directory.GetFiles(Path.Combine(AppContext.BaseDirectory, "Data"), "*.json"))
        {
            var json = File.ReadAllText(file);
            var data = JsonSerializer.Deserialize<JsonElement>(json);
            if (data.TryGetProperty("id", out var id)) races[id.GetString()!] = json;
        }
    }
    public async Task InitializeAsync()
    {
        if (db is null) { logger.LogWarning("Snapshot mode: imported races and bookmarks are temporary without PostgreSQL."); return; }
        await using var conn = await db.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();
        await using (var advisory = new NpgsqlCommand("SELECT pg_advisory_xact_lock(734127)", conn, tx)) await advisory.ExecuteNonQueryAsync();
        await using (var schema = new NpgsqlCommand("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())", conn, tx)) await schema.ExecuteNonQueryAsync();
        foreach (var file in Directory.GetFiles(Path.Combine(AppContext.BaseDirectory,"Migrations"),"*.sql").Order())
        {
            var version = Path.GetFileNameWithoutExtension(file);
            await using var check = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=@version)", conn, tx);
            check.Parameters.AddWithValue("version",version);
            if ((bool)(await check.ExecuteScalarAsync())!) continue;
            await using (var migration = new NpgsqlCommand(await File.ReadAllTextAsync(file), conn, tx)) await migration.ExecuteNonQueryAsync();
            await using var stamp = new NpgsqlCommand("INSERT INTO schema_migrations(version) VALUES (@version)",conn,tx);
            stamp.Parameters.AddWithValue("version",version); await stamp.ExecuteNonQueryAsync();
        }
        foreach (var race in races)
        {
            await using var seed = new NpgsqlCommand("INSERT INTO replay_sessions(id,payload) VALUES (@id,@payload) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,imported_at=now() WHERE COALESCE((replay_sessions.payload->>'schemaVersion')::int,1) < COALESCE((EXCLUDED.payload->>'schemaVersion')::int,1)",conn,tx);
            seed.Parameters.AddWithValue("id",race.Key);seed.Parameters.AddWithValue("payload",NpgsqlDbType.Jsonb,race.Value);await seed.ExecuteNonQueryAsync();
        }
        await tx.CommitAsync();
        logger.LogInformation("PostgreSQL ready; bundled replay revisions upgraded while preserving bookmarks.");
    }
    public async Task<bool> ReadyAsync(CancellationToken ct)
    {
        if(db is null)return true;
        try {await using var cmd=db.CreateCommand("SELECT 1");return (int)(await cmd.ExecuteScalarAsync(ct))! == 1;}
        catch(NpgsqlException){return false;}
    }
    public async Task<HashSet<string>> CachedIdsAsync(CancellationToken ct)
    {
        if(db is null)return races.Keys.ToHashSet();
        await using var cmd=db.CreateCommand("SELECT id FROM replay_sessions");
        await using var reader=await cmd.ExecuteReaderAsync(ct);HashSet<string> ids=[];
        while(await reader.ReadAsync(ct))ids.Add(reader.GetString(0));return ids;
    }
    public async Task<string?> GetRaceAsync(string id,CancellationToken ct)
    {
        if(db is null)return races.GetValueOrDefault(id);
        await using var cmd=db.CreateCommand("SELECT payload::text FROM replay_sessions WHERE id=@id");cmd.Parameters.AddWithValue("id",id);
        return await cmd.ExecuteScalarAsync(ct) as string;
    }
    public async Task SaveRaceAsync(string id,string json,CancellationToken ct)
    {
        if(db is not null) {
            await using var cmd=db.CreateCommand("INSERT INTO replay_sessions(id,payload) VALUES(@id,@payload) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,imported_at=now() WHERE COALESCE((replay_sessions.payload->>'schemaVersion')::int,1) <= COALESCE((EXCLUDED.payload->>'schemaVersion')::int,1)");
            cmd.Parameters.AddWithValue("id",id);cmd.Parameters.AddWithValue("payload",NpgsqlDbType.Jsonb,json);await cmd.ExecuteNonQueryAsync(ct);
        } else races.AddOrUpdate(id,json,(_,existing)=>Version(existing)>Version(json)?existing:json);
    }
    private static int Version(string json){var data=JsonSerializer.Deserialize<JsonElement>(json);return data.TryGetProperty("schemaVersion",out var version)?version.GetInt32():1;}
    public async Task<List<Bookmark>> GetBookmarksAsync(string sessionId,CancellationToken ct)
    {
        if(db is null){lock(gate)return bookmarks.Values.Where(b=>b.SessionId==sessionId).Select(b=>b.Bookmark).OrderBy(b=>b.ElapsedSeconds).ToList();}
        await using var cmd=db.CreateCommand("SELECT id,label,elapsed_seconds,created_at FROM replay_bookmarks WHERE session_id=@session ORDER BY elapsed_seconds");cmd.Parameters.AddWithValue("session",sessionId);
        await using var reader=await cmd.ExecuteReaderAsync(ct);List<Bookmark> result=[];
        while(await reader.ReadAsync(ct))result.Add(new(reader.GetGuid(0),reader.GetString(1),reader.GetDouble(2),reader.GetFieldValue<DateTimeOffset>(3)));return result;
    }
    public async Task<Bookmark> AddBookmarkAsync(string sessionId,string label,double seconds,CancellationToken ct)
    {
        var bookmark=new Bookmark(Guid.NewGuid(),label,seconds,DateTimeOffset.UtcNow);
        if(db is null){lock(gate)bookmarks.Add(bookmark.Id,(sessionId,bookmark));return bookmark;}
        await using var cmd=db.CreateCommand("INSERT INTO replay_bookmarks(id,session_id,label,elapsed_seconds,created_at) VALUES(@id,@session,@label,@seconds,@created)");
        cmd.Parameters.AddWithValue("id",bookmark.Id);cmd.Parameters.AddWithValue("session",sessionId);cmd.Parameters.AddWithValue("label",label);cmd.Parameters.AddWithValue("seconds",seconds);cmd.Parameters.AddWithValue("created",bookmark.CreatedAt);await cmd.ExecuteNonQueryAsync(ct);return bookmark;
    }
    public async Task<bool> DeleteBookmarkAsync(string sessionId,Guid id,CancellationToken ct)
    {
        if(db is null){lock(gate)return bookmarks.TryGetValue(id,out var item)&&item.SessionId==sessionId&&bookmarks.Remove(id);}
        await using var cmd=db.CreateCommand("DELETE FROM replay_bookmarks WHERE id=@id AND session_id=@session");cmd.Parameters.AddWithValue("id",id);cmd.Parameters.AddWithValue("session",sessionId);return await cmd.ExecuteNonQueryAsync(ct)>0;
    }
    public async Task<string?> LoadCatalogAsync(CancellationToken ct)
    {
        if(db is null)return null;
        await using var cmd=db.CreateCommand("SELECT payload::text FROM race_catalog WHERE id='default'");return await cmd.ExecuteScalarAsync(ct) as string;
    }
    public async Task SaveCatalogAsync(string json,CancellationToken ct)
    {
        if(db is null)return;
        await using var cmd=db.CreateCommand("INSERT INTO race_catalog(id,payload) VALUES('default',@payload) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload");cmd.Parameters.AddWithValue("payload",NpgsqlDbType.Jsonb,json);await cmd.ExecuteNonQueryAsync(ct);
    }
}
