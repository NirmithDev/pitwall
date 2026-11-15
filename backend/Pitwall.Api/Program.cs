using System.Text.Json;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Services.AddProblemDetails();
builder.Services.AddResponseCompression();
var connection = builder.Configuration.GetConnectionString("Pitwall");
if (!string.IsNullOrWhiteSpace(connection)) builder.Services.AddSingleton(NpgsqlDataSource.Create(connection));
builder.Services.AddSingleton<RaceStore>();
builder.Services.AddSingleton<NodeGateway>();
builder.Services.AddSingleton<RaceCatalog>();
builder.Services.AddSingleton<RaceImports>();
builder.Services.AddHostedService(services => services.GetRequiredService<RaceImports>());
builder.Services.AddHostedService<CatalogRefreshService>();
var app = builder.Build();
app.UseExceptionHandler();
app.UseResponseCompression();
await app.Services.GetRequiredService<RaceStore>().InitializeAsync();
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/health", async (RaceStore data, CancellationToken ct) =>
    await data.ReadyAsync(ct) ? Results.Ok(new { status = "healthy", storage = data.Storage }) : Results.StatusCode(503));
app.MapGet("/api/status", (RaceStore data) => new { storage = data.Storage, bookmarkScope = "shared-local-development", version = "0.2.0" });
app.MapGet("/api/sessions", async (RaceCatalog catalog, RaceStore store, CancellationToken ct) => {
    var cached = await store.CachedIdsAsync(ct);
    return Results.Ok(new { catalog.Current.RefreshedAt, catalog.Refreshing, catalog.LastError, sessions = catalog.Current.Sessions.Select(s => new { s.Id, s.SessionKey, s.Title, s.Circuit, s.Country, s.CountryCode, s.Year, s.Date, s.Kind, cached = cached.Contains(s.Id) }) });
});
app.MapPost("/api/sessions/refresh", (RaceCatalog catalog, IHostApplicationLifetime lifetime) => {
    catalog.RefreshInBackground(lifetime.ApplicationStopping);
    return Results.Accepted("/api/sessions", new { message = "Catalog refresh requested." });
});
app.MapGet("/api/sessions/{id}", async (string id, RaceStore data, CancellationToken ct) =>
    await data.GetRaceAsync(id, ct) is string json ? Results.Text(json, "application/json") : Results.NotFound(new { message = "Replay is not cached. Import it from the race library first." }));
app.MapPost("/api/sessions/{id}/import", async (string id, RaceCatalog catalog, RaceImports imports, RaceStore data, CancellationToken ct) => {
    var session = catalog.Current.Sessions.FirstOrDefault(s => s.Id == id);
    if (session is null) return Results.NotFound();
    if (await data.GetRaceAsync(id, ct) is not null) return Results.Ok(new ImportJob(id, "completed", null));
    var job = imports.Queue(session);
    return job is null ? Results.Json(new { message = "Import queue is full. Try again shortly." }, statusCode: 429) : Results.Accepted($"/api/sessions/{id}/import", job);
});
app.MapGet("/api/sessions/{id}/import", (string id, RaceImports imports) => imports.Get(id) is ImportJob job ? Results.Ok(job) : Results.NotFound());
app.MapGet("/api/sessions/{id}/bookmarks", async (string id, RaceStore data, CancellationToken ct) =>
    await data.GetRaceAsync(id, ct) is not null ? Results.Ok(await data.GetBookmarksAsync(id, ct)) : Results.NotFound());
app.MapPost("/api/sessions/{id}/bookmarks", async (string id, BookmarkInput input, RaceStore data, CancellationToken ct) => {
    var json = await data.GetRaceAsync(id, ct);
    if (json is null) return Results.NotFound();
    var duration = JsonSerializer.Deserialize<JsonElement>(json).GetProperty("duration").GetDouble();
    if (string.IsNullOrWhiteSpace(input.Label) || input.Label.Trim().Length > 80 || !double.IsFinite(input.ElapsedSeconds) || input.ElapsedSeconds < 0 || input.ElapsedSeconds > duration)
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["bookmark"] = ["Provide a label of 1–80 characters and a time within the race."] });
    var bookmark = await data.AddBookmarkAsync(id, input.Label.Trim(), input.ElapsedSeconds, ct);
    return Results.Created($"/api/sessions/{id}/bookmarks/{bookmark.Id}", bookmark);
});
app.MapDelete("/api/sessions/{id}/bookmarks/{bookmarkId:guid}", async (string id, Guid bookmarkId, RaceStore data, CancellationToken ct) =>
    await data.DeleteBookmarkAsync(id, bookmarkId, ct) ? Results.NoContent() : Results.NotFound());
app.Map("/api/{**path}", () => Results.NotFound());
app.MapFallbackToFile("index.html");
app.Run();

public record BookmarkInput(string? Label, double ElapsedSeconds);
public record Bookmark(Guid Id, string Label, double ElapsedSeconds, DateTimeOffset CreatedAt);
public partial class Program { }
