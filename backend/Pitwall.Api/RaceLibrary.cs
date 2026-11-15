using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Channels;

public record CatalogSession(string Id,int SessionKey,string Title,string Circuit,string Country,string CountryCode,int Year,string Date,string Kind);
public record CatalogDocument(DateTimeOffset RefreshedAt,CatalogSession[] Sessions);
public record ImportJob(string SessionId,string Status,string? Error);

public sealed class NodeGateway
{
    private readonly SemaphoreSlim gate = new(1,1);
    public async Task<string> RunAsync(bool catalog,int? sessionKey,CancellationToken ct)
    {
        await gate.WaitAsync(ct);
        try {
            using var timeout=CancellationTokenSource.CreateLinkedTokenSource(ct);timeout.CancelAfter(TimeSpan.FromMinutes(8));
            var start=new ProcessStartInfo("node"){UseShellExecute=false,RedirectStandardOutput=true,RedirectStandardError=true,CreateNoWindow=true};
            start.ArgumentList.Add(Path.Combine(AppContext.BaseDirectory,"DataTools","import-race.mjs"));start.ArgumentList.Add("--worker");
            if(catalog)start.ArgumentList.Add("--catalog");else{start.ArgumentList.Add("--session");start.ArgumentList.Add(sessionKey!.Value.ToString(System.Globalization.CultureInfo.InvariantCulture));}
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
    private readonly Channel<CatalogSession> queue=Channel.CreateBounded<CatalogSession>(8);
    private readonly ConcurrentDictionary<string,ImportJob> jobs=new();
    private readonly object gate=new();
    public ImportJob? Get(string id)=>jobs.GetValueOrDefault(id);
    public ImportJob? Queue(CatalogSession session)
    {
        lock(gate){if(jobs.TryGetValue(session.Id,out var existing)&&existing.Status is "queued" or "running" or "completed")return existing;
            var job=new ImportJob(session.Id,"queued",null);jobs[session.Id]=job;
            if(queue.Writer.TryWrite(session))return job;jobs.TryRemove(session.Id,out _);return null;}
    }
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach(var session in queue.Reader.ReadAllAsync(stoppingToken)) {
            jobs[session.Id]=new(session.Id,"running",null);
            try {
                var json=await node.RunAsync(false,session.SessionKey,stoppingToken);
                var data=JsonSerializer.Deserialize<JsonElement>(json);
                if(data.GetProperty("id").GetString()!=session.Id||data.GetProperty("duration").GetDouble()<=0)throw new InvalidOperationException("Unexpected replay data.");
                await store.SaveRaceAsync(session.Id,json,stoppingToken);jobs[session.Id]=new(session.Id,"completed",null);
            }catch(Exception e)when(!stoppingToken.IsCancellationRequested){logger.LogWarning(e,"Import failed for {Session}",session.Id);jobs[session.Id]=new(session.Id,"failed","OpenF1 could not supply a usable replay for this session. Retry later; other cached races remain available.");}
        }
    }
}
