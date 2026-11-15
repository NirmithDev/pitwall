# Pitwall — Race Replay Lab

An independent motorsport replay prototype built with React, TypeScript, ASP.NET Core 10, and PostgreSQL 17. Start with recorded races; later, branch into player-controlled strategy simulations.

## What works now

- A searchable historical library covering completed Grand Prix and Sprint sessions exposed by OpenF1 from 2023 onward. The current catalog lists 114 non-cancelled sessions, through Interlagos on 8 November 2026.
- Season and session filters, latest-race highlighting, and explicit cached/import states.
- Bundled Monza 2024 and Interlagos 2026 replays. Other sessions import on demand and persist in PostgreSQL.
- Play/pause, 1×–50× playback, timeline scrubbing, lap jumps, and keyboard controls.
- Driver focus, last-lap comparisons, and clickable tyre-strategy strips.
- Original SVG circuit outline with lap-time-based marker interpolation.
- Save, revisit, and delete replay moments. Bookmarks are isolated by race and survive API restarts in PostgreSQL.
- Database migrations, Docker Compose, integration tests, browser tests, and GitHub Actions.

## Run the whole app with Docker

Prerequisites: Docker Desktop running with the Linux engine; Node 24 for the one-time environment setup.

```powershell
node scripts/setup-env.mjs
docker compose up --build -d
docker compose ps
```

Open **http://localhost:8080**. The interface should say **PostgreSQL connected**.

The setup script creates an ignored `.env` with a random development database password. It never overwrites an existing file. The database is published only to `127.0.0.1:55432` and the app only to `127.0.0.1:8080`.

See [the Docker walkthrough](docs/DOCKER.md) to understand images, containers, ports, volumes, logs, and development mode.

## Develop with hot reload

Prerequisites: Node 24, .NET 10 SDK, Docker Desktop. A system PostgreSQL installation is unnecessary when using the container.

```powershell
node scripts/setup-env.mjs
docker compose up -d db
```

Terminal 1, from the repository root:

```powershell
./scripts/dev-api.ps1
```

Terminal 2:

```powershell
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` requests to the C# backend on port 5080.

For a preview without PostgreSQL, run `./scripts/dev-api.ps1 -Snapshot`. The race still works, but bookmarks are temporary and shared in API memory. Snapshot mode is explicitly labeled in the interface.

## Validate

```powershell
dotnet build backend/Pitwall.Api/Pitwall.Api.csproj -c Release
python scripts/test-api.py
cd frontend
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Python 3.12+ is required for API integration tests. The PostgreSQL integration test is `python scripts/test-api.py --postgres` with `ConnectionStrings__Pitwall` set. CI supplies a disposable PostgreSQL service and verifies persistence across an API restart. Tests create and delete their own bookmark; they do not reset the database.

Browser tests exercise the production frontend build. Stop other development servers before running them when you want isolated test processes.

## Data and accuracy

Open **Browse races** to search the archive, filter seasons or Sprint/Grand Prix sessions, and select a replay. The default view opens the newest cached race. A first-time import runs in a background queue; progress is visible, closing the library does not cancel the server import, and later visits read the cached replay. The catalog is a list of provider sessions, not a promise that every session has complete telemetry. Missing or unusable timing returns a clear error.

The catalog refreshes automatically when older than 12 hours, checked hourly while the backend runs. **Check for new races** requests an immediate refresh. If the provider is unavailable, the existing catalog and cached races remain available. Imports and catalog refreshes share a single worker gate with paced API requests; multiple server replicas would need a shared queue/rate limiter before scaling ingestion horizontally.

Node 24 runs the ingestion worker alongside C#. The Docker image includes it; local API development requires Node on PATH. SQL migration `002_catalog` persists refreshed catalogs. No provider requests are needed for already cached replay playback.

Import a specific session manually with `node scripts/import-race.mjs --session 11412`, or refresh the bundled catalog with `node scripts/import-race.mjs --catalog`. These write snapshots into `data/`; rebuild the API afterward to bundle them. Normal UI imports are stored in PostgreSQL instead.

The bundled snapshots were imported from [OpenF1](https://openf1.org/): session **9590** (Monza, 1 September 2024) and **11412** (Interlagos, 8 November 2026). Routine builds and automated tests do not query the provider. Live imports and catalog refreshes require network access.

Lap times, classification messages, stints, and race-control messages are recorded data. **Car movement is interpolated uniformly along a circuit outline using lap duration. It is not GPS playback.** It cannot show true braking points, corner speeds, or on-track separation. The outline comes from one recorded lap's coordinates.

Classification messages arrive asynchronously and may temporarily repeat positions; ties use lap progress. Missing timed laps can pause a marker. Last-lap comparisons may compare different lap numbers. The strategy strip deliberately reveals full-race stints.

This is an educational, independent prototype, not an official Formula 1 product. It includes no broadcasts, team logos, driver photographs, or audio. Open-source software access does not establish commercial rights to underlying data or trademarks. Check [OpenF1's usage guidance](https://openf1.org/) and [Formula 1's guidelines](https://www.formula1.com/en/information/guidelines.4EOKE9RRqevL4niTK9kWyt) before commercial use.

## Structure

```text
frontend/                 React app, timing engine, unit/browser tests
backend/Pitwall.Api/       C# API, PostgreSQL storage, SQL migrations
data/                     Bundled historical replay
scripts/                  Data import, environment setup, API checks
.github/workflows/ci.yml   Test, build, and container delivery
compose.yaml              Local app + PostgreSQL orchestration
Dockerfile                Multi-stage production build
```

## CI and delivery

Branch workflow: `main` holds the release baseline, `develop` integrates reviewed work, and `feature/*` branches hold individual changes. Open pull requests from feature branches into `develop`, then promote tested releases to `main`. CI runs on `main`, `develop`, feature branch pushes, and pull requests. The push helper accepts branch names, for example `node scripts/push-github.mjs develop feature/race-library`.

For the first push from your own Windows terminal, `node scripts/push-github.mjs` handles the sandbox folder ownership check for that command and requests a fresh GitHub device-code sign-in through Git Credential Manager. Open the displayed verification page in your preferred browser. The helper isolates this repository's credential namespace; it does not read credentials, change global Git trust, or erase credentials for other repositories.

Pull requests and pushes to `main` run timing tests, production builds, PostgreSQL integration checks, and browser tests. A second job builds the full Docker image. Successful `main` builds publish `latest` and commit-SHA tags to `ghcr.io/<owner>/<repository>` using GitHub's built-in token.

This is **continuous integration and image delivery**, not deployment to a live hosting service. No deployment host or credentials are configured. The first Actions run must pass before treating the hosted pipeline as verified.

## Next milestones

1. Plan the map extension: zoom/pan, driver visibility, focus controls, and custom display settings.
2. Improve replay fidelity with recorded per-driver location samples and missing-data handling.
3. Add authentication and private user bookmarks.
4. Calibrate a strategy model, then add “take control from here” branches with explicit assumptions.
5. Plan upgrades and team progression; car designs, 3D models, and detailed upgrade models are deferred.

The present API is for local development: bookmarks are shared and have no account ownership or authorization. Add accounts, authorization, rate limits, and a production database backup plan before opening a multi-user service.
