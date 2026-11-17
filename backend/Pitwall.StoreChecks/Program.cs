using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;

static void Check(bool condition,string message){if(!condition)throw new InvalidOperationException(message);}

async Task VerifyAsync(string? connection)
{
    var services=new ServiceCollection();
    if(connection is not null)services.AddSingleton(NpgsqlDataSource.Create(connection));
    await using var provider=services.BuildServiceProvider();
    var store=new RaceStore(provider,NullLogger<RaceStore>.Instance);
    await store.InitializeAsync();
    var id="store-check-"+Guid.NewGuid().ToString("N");
    var timing=new JsonObject{["id"]=id,["schemaVersion"]=1,["duration"]=100};
    var located=(JsonObject)timing.DeepClone();located["schemaVersion"]=2;
    located["locations"]=JsonNode.Parse("{\"traces\":[{\"driver\":16,\"samples\":[[0,1,1],[1000,2,2]]}]}");
    var analysis=new JsonObject{["id"]=id,["version"]=1,["laps"]=JsonNode.Parse("[{\"driver\":16,\"lap\":2,\"sectors\":[25,28,30]}]")};
    Guid? bookmark=null;
    try {
        await store.SaveRaceAsync(id,timing.ToJsonString(),default);
        bookmark=(await store.AddBookmarkAsync(id,"Store check",20,default)).Id;
        await store.SaveAnalysisAsync(id,analysis.ToJsonString(),default);
        await store.SaveRaceAsync(id,located.ToJsonString(),default);
        var combined=JsonNode.Parse((await store.GetRaceAsync(id,default))!)!;
        Check(combined["analysis"] is not null&&combined["locations"] is not null,"Location upgrade discarded measured analysis.");
        await store.SaveRaceAsync(id,timing.ToJsonString(),default);
        combined=JsonNode.Parse((await store.GetRaceAsync(id,default))!)!;
        Check(combined["schemaVersion"]!.GetValue<int>()==2&&combined["locations"] is not null,"Timing import downgraded recorded positions.");
        analysis["marker"]="newer";
        await Task.WhenAll(store.SaveAnalysisAsync(id,analysis.ToJsonString(),default),store.SaveRaceAsync(id,located.ToJsonString(),default));
        combined=JsonNode.Parse((await store.GetRaceAsync(id,default))!)!;
        Check(combined["analysis"]?["marker"]?.GetValue<string>()=="newer"&&combined["locations"] is not null,"Concurrent writes lost independent enrichments.");
        analysis["marker"]="seed";
        await store.SaveAnalysisAsync(id,analysis.ToJsonString(),default,true);
        combined=JsonNode.Parse((await store.GetRaceAsync(id,default))!)!;
        Check(combined["analysis"]?["marker"]?.GetValue<string>()=="newer","Bundled seed overwrote cached analysis.");
        Check((await store.GetBookmarksAsync(id,default)).Any(b=>b.Id==bookmark),"Enrichment discarded bookmarks.");
        Console.WriteLine($"PASS: {store.Storage} enrichment merge, downgrade protection, concurrent writes, seed safety, bookmarks");
    } finally {
        if(bookmark is Guid saved)await store.DeleteBookmarkAsync(id,saved,default);
        if(connection is not null){await using var db=NpgsqlDataSource.Create(connection);await using var command=db.CreateCommand("DELETE FROM replay_sessions WHERE id=@id");command.Parameters.AddWithValue("id",id);await command.ExecuteNonQueryAsync();}
    }
}

await VerifyAsync(null);
var connection=Environment.GetEnvironmentVariable("ConnectionStrings__Pitwall");
if(!string.IsNullOrWhiteSpace(connection))await VerifyAsync(connection);
