using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Services.AddProblemDetails();
var connection = builder.Configuration.GetConnectionString("Pitwall");
if (!string.IsNullOrWhiteSpace(connection)) builder.Services.AddSingleton(NpgsqlDataSource.Create(connection));
builder.Services.AddSingleton<RaceStore>();
var app = builder.Build();
app.UseExceptionHandler();
var store = app.Services.GetRequiredService<RaceStore>();
await store.InitializeAsync();
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/health", async (RaceStore data, CancellationToken ct) =>
    await data.ReadyAsync(ct) ? Results.Ok(new { status = "healthy", storage = data.Storage }) : Results.StatusCode(503));
app.MapGet("/api/status", (RaceStore data) => new { storage = data.Storage, bookmarkScope = "shared-local-development", version = "0.1.0" });
app.MapGet("/api/sessions", (RaceStore data) => {
    var race = data.Snapshot;
    return new[] { new { id = race.GetProperty("id").GetString(), title = race.GetProperty("title").GetString(), circuit = race.GetProperty("circuit").GetString(), year = race.GetProperty("year").GetInt32() } };
});
app.MapGet("/api/sessions/{id}", async (string id, RaceStore data, CancellationToken ct) =>
    id == RaceStore.SessionId ? Results.Text(await data.GetRaceAsync(ct), "application/json") : Results.NotFound());
app.MapGet("/api/sessions/{id}/bookmarks", async (string id, RaceStore data, CancellationToken ct) =>
    id == RaceStore.SessionId ? Results.Ok(await data.GetBookmarksAsync(ct)) : Results.NotFound());
app.MapPost("/api/sessions/{id}/bookmarks", async (string id, BookmarkInput input, RaceStore data, CancellationToken ct) => {
    if (id != RaceStore.SessionId) return Results.NotFound();
    if (string.IsNullOrWhiteSpace(input.Label) || input.Label.Trim().Length > 80 || !double.IsFinite(input.ElapsedSeconds) || input.ElapsedSeconds < 0 || input.ElapsedSeconds > data.Duration)
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["bookmark"] = ["Provide a label of 1–80 characters and a time within the race."] });
    var bookmark = await data.AddBookmarkAsync(input.Label.Trim(), input.ElapsedSeconds, ct);
    return Results.Created($"/api/sessions/{id}/bookmarks/{bookmark.Id}", bookmark);
});
app.MapDelete("/api/sessions/{id}/bookmarks/{bookmarkId:guid}", async (string id, Guid bookmarkId, RaceStore data, CancellationToken ct) =>
    id != RaceStore.SessionId ? Results.NotFound() : await data.DeleteBookmarkAsync(bookmarkId, ct) ? Results.NoContent() : Results.NotFound());
app.Map("/api/{**path}", () => Results.NotFound());
app.MapFallbackToFile("index.html");
app.Run();

public record BookmarkInput(string? Label, double ElapsedSeconds);
public record Bookmark(Guid Id, string Label, double ElapsedSeconds, DateTimeOffset CreatedAt);

public sealed class RaceStore
{
    public const string SessionId = "monza-2024";
    private readonly NpgsqlDataSource? db;
    private readonly ILogger<RaceStore> logger;
    private readonly string json;
    private readonly List<Bookmark> memoryBookmarks = [];
    private readonly object gate = new();
    public JsonElement Snapshot { get; }
    public double Duration => Snapshot.GetProperty("duration").GetDouble();
    public string Storage => db is null ? "snapshot" : "postgresql";

    public RaceStore(IServiceProvider services, ILogger<RaceStore> logger)
    {
        db = services.GetService<NpgsqlDataSource>();
        this.logger = logger;
        json = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Data", "monza-2024.json"));
        Snapshot = JsonSerializer.Deserialize<JsonElement>(json);
    }
    public async Task InitializeAsync()
    {
        if (db is null) { logger.LogWarning("Snapshot mode: bookmarks are temporary. Configure ConnectionStrings__Pitwall for PostgreSQL persistence."); return; }
        await using var conn = await db.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();
        // Serialize schema initialization across concurrently starting replicas.
        await using (var advisory = new NpgsqlCommand("SELECT pg_advisory_xact_lock(734127)", conn, tx)) await advisory.ExecuteNonQueryAsync();
        await using (var schema = new NpgsqlCommand("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())", conn, tx)) await schema.ExecuteNonQueryAsync();
        await using var check = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version='001_initial')", conn, tx);
        if (!(bool)(await check.ExecuteScalarAsync())!)
        {
            var sql = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "Migrations", "001_initial.sql"));
            await using (var migration = new NpgsqlCommand(sql, conn, tx)) await migration.ExecuteNonQueryAsync();
            await using (var stamp = new NpgsqlCommand("INSERT INTO schema_migrations(version) VALUES ('001_initial')", conn, tx)) await stamp.ExecuteNonQueryAsync();
        }
        await using var seed = new NpgsqlCommand("INSERT INTO replay_sessions(id,payload) VALUES (@id,@payload) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload, imported_at=now()", conn, tx);
        seed.Parameters.AddWithValue("id", SessionId);
        seed.Parameters.AddWithValue("payload", NpgsqlDbType.Jsonb, json);
        await seed.ExecuteNonQueryAsync();
        await tx.CommitAsync();
        logger.LogInformation("PostgreSQL ready; historical replay seeded.");
    }
    public async Task<bool> ReadyAsync(CancellationToken ct)
    {
        if (db is null) return true;
        try { await using var cmd = db.CreateCommand("SELECT 1"); return (int)(await cmd.ExecuteScalarAsync(ct))! == 1; }
        catch (NpgsqlException) { return false; }
    }
    public async Task<string> GetRaceAsync(CancellationToken ct)
    {
        if (db is null) return json;
        await using var cmd = db.CreateCommand("SELECT payload::text FROM replay_sessions WHERE id=@id");
        cmd.Parameters.AddWithValue("id", SessionId);
        return (string)(await cmd.ExecuteScalarAsync(ct))!;
    }
    public async Task<List<Bookmark>> GetBookmarksAsync(CancellationToken ct)
    {
        if (db is null) { lock(gate) return memoryBookmarks.OrderBy(b=>b.ElapsedSeconds).ToList(); }
        await using var cmd = db.CreateCommand("SELECT id,label,elapsed_seconds,created_at FROM replay_bookmarks WHERE session_id=@session ORDER BY elapsed_seconds");
        cmd.Parameters.AddWithValue("session", SessionId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        List<Bookmark> results = [];
        while (await reader.ReadAsync(ct)) results.Add(new(reader.GetGuid(0),reader.GetString(1),reader.GetDouble(2),reader.GetFieldValue<DateTimeOffset>(3)));
        return results;
    }
    public async Task<Bookmark> AddBookmarkAsync(string label, double seconds, CancellationToken ct)
    {
        var bookmark = new Bookmark(Guid.NewGuid(),label,seconds,DateTimeOffset.UtcNow);
        if (db is null) { lock(gate) memoryBookmarks.Add(bookmark); return bookmark; }
        await using var cmd = db.CreateCommand("INSERT INTO replay_bookmarks(id,session_id,label,elapsed_seconds,created_at) VALUES(@id,@session,@label,@seconds,@created)");
        cmd.Parameters.AddWithValue("id",bookmark.Id); cmd.Parameters.AddWithValue("session",SessionId);
        cmd.Parameters.AddWithValue("label",label); cmd.Parameters.AddWithValue("seconds",seconds); cmd.Parameters.AddWithValue("created",bookmark.CreatedAt);
        await cmd.ExecuteNonQueryAsync(ct);
        return bookmark;
    }
    public async Task<bool> DeleteBookmarkAsync(Guid id, CancellationToken ct)
    {
        if (db is null) { lock(gate) return memoryBookmarks.RemoveAll(b=>b.Id==id)>0; }
        await using var cmd=db.CreateCommand("DELETE FROM replay_bookmarks WHERE id=@id AND session_id=@session");
        cmd.Parameters.AddWithValue("id",id); cmd.Parameters.AddWithValue("session",SessionId);
        return await cmd.ExecuteNonQueryAsync(ct)>0;
    }
}
public partial class Program { }
