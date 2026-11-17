# Start Pitwall and choose a race

[Guide home](../USER-GUIDE.md) · [Replay and map](02-replay-map.md)

Commands run from the repository root unless stated otherwise. Choose one way to run the app; you do not need all three at once.

<a id="start-01"></a>
## START-01 — Run the complete app in Docker

**What:** Start PostgreSQL and the built frontend/API together.

**How:** With Node 24 and Docker Desktop's Linux engine available, run `node scripts/setup-env.mjs`, then `docker compose up --build -d`. Check `docker compose ps` and open `http://localhost:8080` (or your configured `APP_PORT`).

**Result and storage:** The setup helper creates an ignored `.env` if missing and keeps existing settings. The app should show **PostgreSQL connected**. Database data lives in the Compose volume; browser preferences live in the browser used to visit this address.

**Recovery and limits:** If Docker has no working Server section in `docker info`, start Docker Desktop first. Use `docker compose logs app` and `docker compose logs db` for startup failures. Editing `.env` does not change a database password already initialized in a volume. See [Docker help](../DOCKER.md); removing the database volume is not a routine repair.

<a id="start-02"></a>
## START-02 — Develop with hot reload

**What:** Run the database in Docker and edit React/C# on your machine.

**How:** Run `node scripts/setup-env.mjs` and `docker compose up -d db`. In one terminal run `./scripts/dev-api.ps1`. In another, enter `frontend`, run `npm ci`, then `npm run dev`. Open `http://localhost:5173`. Use `./scripts/dev-api.ps1 -Snapshot` when deliberately choosing temporary API storage.

**Result and storage:** Vite serves the interface and forwards API requests to port 5080. The API helper reads local database settings without printing the password. Source edits can be viewed without rebuilding the full container.

**Recovery and limits:** Check the terminal errors and database port before changing configuration. `localhost:5173` and `127.0.0.1:5080` have separate browser storage, even when both use the same API/database.

<a id="start-03"></a>
## START-03 — Run an already-built local preview

**What:** Serve the production frontend and API from one local address.

**How:** Build the API with `dotnet build backend/Pitwall.Api -c Release`. In `frontend`, run `npm ci` if needed and `npm run build`. Return to the root and run `node scripts/preview.mjs`. Open `http://127.0.0.1:5080`. Optional arguments are `--snapshot` and `--port 5082`.

**Result and storage:** The helper checks Node/.NET, build artifacts, the chosen port and—outside snapshot mode—the local database connection. It recognizes an existing Pitwall instance instead of stopping it. Ctrl+C stops the API it started.

**Recovery and limits:** Missing builds need the build commands above. A busy port belonging to another service needs a different `--port`. This helper does not start Docker or rebuild changed source automatically. Its automatic catalog refresh is disabled; the library's manual refresh still works.

<a id="start-04"></a>
## START-04 — Diagnose the local setup

**What:** Check prerequisites before trying to start or reconfigure services.

**How:** Run `node scripts/doctor.mjs` from the checkout. Read the installed versions, dependency/build availability, database TCP result and local port summaries.

**Result and storage:** This is read-only. It reports Node, .NET, Git, Docker CLI, Compose, build files and reachable previews without printing credentials.

**Recovery and limits:** A Docker CLI version does not prove its engine is running; a reachable database port is a separate check. Restricted command sessions can lack Docker's Windows named-pipe access while your own PowerShell works. Fix the reported prerequisite rather than reinstalling everything.

<a id="start-05"></a>
## START-05 — Choose light or dark mode

**What:** Change the interface appearance.

**How:** Use **Light mode** or **Dark mode** in the header. The button describes the mode it will switch to.

**Result and storage:** First visit uses the system preference if no saved choice exists. An explicit toggle saves the choice for this browser origin. It applies across races and tools.

**Recovery and limits:** If browser storage is blocked, the current toggle still works but may not survive reload. A different browser, hostname or port has a separate preference. This is not a continuously synchronized OS-theme setting.

<a id="start-06"></a>
## START-06 — Recover from a load or tool failure

**What:** Return to a usable replay after a startup or downloaded-tool error.

**How:** For **We couldn’t load the race**, check that the API is running, then choose **Try again**. For **Replay tool unavailable**, choose **Return to replay**, or **Reload Pitwall** to obtain the current tool bundle. Close normal tool dialogs with their close button or Escape.

**Result and storage:** Tool code downloads only when needed. A failed tool is isolated from the main replay. Reload retries startup and reads saved data again.

**Recovery and limits:** Reload/closing a tool can discard unsaved tool drafts. Cached races still need a running API; an external provider outage is different from the API being unavailable. Do not expect a failed import to create a usable cached race.

<a id="lib-01"></a>
## LIB-01 — Search and filter the race library

**What:** Find completed Grand Prix or Sprint sessions.

**How:** Choose **Browse races**. Use **Search races**, **Season**, and **Session type** together. Clear the search or restore **All seasons** / **Race + Sprint** if no results match.

**Result and storage:** The library displays the current catalog, latest-available badge and cache state. Opening it pauses replay playback. Search/filter selections are temporary to this library visit.

**Recovery and limits:** A catalog listing means the provider exposes a completed session, not that every measurement is complete. Upcoming, practice and cancelled sessions are excluded. The catalog's last-checked time identifies its freshness.

<a id="lib-02"></a>
## LIB-02 — Open a cached race

**What:** Switch to a replay already stored by this API.

**How:** In the library, choose a **CACHED** race card / **Open replay**. The card's accessible name is **Load [circuit] [year] [kind]**.

**Result and storage:** The replay opens paused at time zero with that race's bookmarks and saved default map layout. Driver focus defaults to Leclerc when present, otherwise the first available driver; Norris is the default comparison when available and different. The URL's race selection updates. Source defaults to recorded positions if cached, otherwise lap estimates.

**Recovery and limits:** Loading a race is not a cloud save of your current playback position. Reopening another race discards transient camera changes unless saved; playback speed can remain from the current visit. Normal page startup chooses the newest cached catalog session unless a recognized race link requests another.

<a id="lib-03"></a>
## LIB-03 — Import an uncached race

**What:** Download historical timing and cache a new replay.

**How:** Choose **Load replay** on an uncached card. Watch the queued/downloading/opening status. Once complete, the library opens the replay. Recorded positions and measured analysis are separate optional upgrades after timing loads.

**Result and storage:** PostgreSQL retains successful imports across API restarts. Snapshot mode retains them only until this API process stops. Duplicate active requests for the same import reuse a job.

**Recovery and limits:** Closing the library stops this browser's wait, not the server job. Reopen later to reconnect/use the cache. A provider failure or full queue leaves the current replay available; retry later or choose a cached race. The browser can stop waiting before queued server work finishes. There is no import-cancel or race-cache-delete button.

<a id="lib-04"></a>
## LIB-04 — Check for new completed races

**What:** Refresh the catalog without replacing the replay currently open.

**How:** Open **Browse races → Check for new races**. Wait for refresh to finish and inspect the checked time / latest session. Search and filters still control what is shown.

**Result and storage:** A successful refresh updates the API catalog, persisted in PostgreSQL when enabled. Already cached replay data stays available. Default server operation also checks stale catalogs periodically; the local preview helper and CI disable automatic checks.

**Recovery and limits:** If the provider is unavailable, the previous catalog remains. Reopen the library to inspect a long-running refresh. Refreshing the catalog does not import every listed race or automatically load its recorded coordinates.
