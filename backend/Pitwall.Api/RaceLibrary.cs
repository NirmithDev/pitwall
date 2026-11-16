using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Channels;

public record CatalogSession(string Id,int SessionKey,string Title,string Circuit,string Country,string CountryCode,int Year,string Date,string Kind);
public record CatalogDocument(DateTimeOffset RefreshedAt,CatalogSession[] Sessions);
public record ImportJob(string SessionId,string Status,string? Error,string Kind="timing");
public record ImportRequest(CatalogSession Session,bool IncludeLocations);

public static class RaceData
{
    public static bool HasLocations(string? json)
    {
        if(json is null)return false;
        var data=JsonSerializer.Deserialize<JsonElement>(json);
        return data.TryGetProperty("locations",out var locations)&&locations.TryGetProperty("traces",out var traces)&&traces.EnumerateArray().Any(t=>t.TryGetProperty("samples",out var samples)&&samples.GetArrayLength()>1);
    }
}

public sealed class NodeGateway
{
    private readonly SemaphoreSlim gate = new(1,1);
    public async Task<string> RunAsync(bool catalog,int? sessionKey,CancellationToken ct,bool includeLocations=false)
    {
        await gate.WaitAsync(ct);
        try {
            using var timeout=CancellationTokenSource.CreateLinkedTokenSource(ct);timeout.CancelAfter(TimeSpan.FromMinutes(8));
            var start=new ProcessStartInfo("node"){UseShellExecute=false,RedirectStandardOutput=true,RedirectStandardError=true,CreateNoWindow=true};
            start.ArgumentList.Add(Path.Combine(AppContext.BaseDirectory,"DataTools","import-race.mjs"));start.ArgumentList.Add("--worker");
            if(catalog)start.ArgumentList.Add("--catalog");else{start.ArgumentList.Add("--session");start.ArgumentList.Add(sessionKey!.Value.ToString(System.Globalization.CultureInfo.InvariantCulture));}
            if(includeLocations)start.ArgumentList.Add("--locations");
            using var process=Process.Start(start)??throw new InvalidOperationException("Could not start the data worker. Node 24 is required.");
            using var cancellation=timeout.Token.Register(()=>{try{if(!process.HasExited)process.Kill(entireProcessTree:true);}catch(InvalidOperationException){}});
            var stdout=process.StandardOutput.ReadToEndAsync(timeout.Token);var stderr=process.StandardError.ReadToEndAsync(timeout.Token);
            await process.WaitForExitAsync(timeout.Token);var output=await stdout;var error=await stderr;
            if(process.ExitCode!=0)throw new InvalidOperationException(string.IsNullOrWhiteSpace(error)?"The data provider could not load this session.":error.Trim());
            return output;
        } finally{gate.Release();}
    }
}
public sealed class RaceCatalog(NodeGateway node,RaceStore store,ILogger<RaceCatalog> logger)
{
    public static readonly JsonSerializerOptions JsonOptions=new(JsonSerializerDefaults.Web);
    private CatalogDocument current=JsonSerializer.Deserialize<CatalogDocument>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"Data","catalog.json")),JsonOptions)!;
    private int refreshing;
    public CatalogDocument Current=>Volatile.Read(ref current);
    public bool Refreshing=>Volatile.Read(ref refreshing)==1;
    public string? LastError{get;private set;}
    public async Task LoadPersistedAsync(CancellationToken ct)
    {
        var json=await store.LoadCatalogAsync(ct);
        if(json is not null){var saved=JsonSerializer.Deserialize<CatalogDocument>(json,JsonOptions);if(saved?.RefreshedAt>Current.RefreshedAt)Volatile.Write(ref current,saved);}
    }
    public void RefreshInBackground(CancellationToken ct)=>_ = RefreshAsync(ct);
    public async Task RefreshAsync(CancellationToken ct)
    {
        if(Interlocked.CompareExchange(ref refreshing,1,0)!=0)return;
        try {
            var json=await node.RunAsync(true,null,ct);
            var next=JsonSerializer.Deserialize<CatalogDocument>(json,JsonOptions)??throw new InvalidOperationException("Empty catalog.");
            if(next.Sessions.Length==0)throw new InvalidOperationException("Empty catalog.");
            await store.SaveCatalogAsync(json,ct);Volatile.Write(ref current,next);LastError=null;
        }catch(Exception e)when(!ct.IsCancellationRequested){logger.LogWarning(e,"Catalog refresh failed; keeping previous data.");LastError="Could not refresh from OpenF1. The previous catalog is still available.";}
        finally{Interlocked.Exchange(ref refreshing,0);}
    }
}
public sealed class CatalogRefreshService(RaceCatalog catalog,IConfiguration config):BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await catalog.LoadPersistedAsync(stoppingToken);
        if(!config.GetValue("Catalog:AutoRefresh",true))return;
        while(!stoppingToken.IsCancellationRequested){if(DateTimeOffset.UtcNow-catalog.Current.RefreshedAt>TimeSpan.FromHours(12))await catalog.RefreshAsync(stoppingToken);await Task.Delay(TimeSpan.FromHours(1),stoppingToken);}
    }
}
public sealed class RaceImports(NodeGateway node,RaceStore store,ILogger<RaceImports> logger):BackgroundService
{
    private readonly Channel<ImportRequest> queue=Channel.CreateBounded<ImportRequest>(8);
    private readonly ConcurrentDictionary<string,ImportJob> jobs=new();
    private readonly object gate=new();
    private static string Key(string id,bool locations)=>id+(locations?":locations":":timing");
    public ImportJob? Get(string id,bool includeLocations=false)=>jobs.GetValueOrDefault(Key(id,includeLocations));
    public ImportJob? Queue(CatalogSession session,bool includeLocations=false)
    {
        var key=Key(session.Id,includeLocations);
        lock(gate){if(jobs.TryGetValue(key,out var existing)&&existing.Status is "queued" or "running" or "completed")return existing;
            var job=new ImportJob(session.Id,"queued",null,includeLocations?"locations":"timing");jobs[key]=job;
            if(queue.Writer.TryWrite(new(session,includeLocations)))return job;jobs.TryRemove(key,out _);return null;}
    }
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach(var request in queue.Reader.ReadAllAsync(stoppingToken)) {
            var session=request.Session;var key=Key(session.Id,request.IncludeLocations);var kind=request.IncludeLocations?"locations":"timing";
            jobs[key]=new(session.Id,"running",null,kind);
            try {
                var json=await node.RunAsync(false,session.SessionKey,stoppingToken,request.IncludeLocations);
                var data=JsonSerializer.Deserialize<JsonElement>(json);
                if(data.GetProperty("id").GetString()!=session.Id||data.GetProperty("duration").GetDouble()<=0)throw new InvalidOperationException("Unexpected replay data.");
                if(request.IncludeLocations&&!RaceData.HasLocations(json))throw new InvalidOperationException("No usable recorded locations were returned.");
                await store.SaveRaceAsync(session.Id,json,stoppingToken);jobs[key]=new(session.Id,"completed",null,kind);
            }catch(Exception e)when(!stoppingToken.IsCancellationRequested){logger.LogWarning(e,"Import failed for {Session}",session.Id);jobs[key]=new(session.Id,"failed",request.IncludeLocations?"Recorded positions could not be loaded for this session. Your existing replay is unchanged; retry later or use lap estimates.":"OpenF1 could not supply a usable replay for this session. Retry later; other cached races remain available.",kind);}
        }
    }
}
