# Docker, using this project

Your machine already has Docker Desktop, Docker CLI, Compose, and a working WSL2 Linux engine. Your `docker info` output confirmed the Server section and Linux container support. No reinstall is needed. PostgreSQL 17 is also installed on Windows, but this project uses a separate PostgreSQL container.

## The four pieces

| Piece | Meaning | In Pitwall |
| --- | --- | --- |
| Image | A packaged filesystem and startup command | `postgres:17-alpine`, and our app built by `Dockerfile` |
| Container | A running instance of an image | `pitwall-db-1` and `pitwall-app-1` |
| Volume | Storage that outlives the container | `pitwall-postgres` holds database files |
| Compose | A description of services and how they connect | `compose.yaml` |

## What the Dockerfile does

1. A Node build stage installs locked npm dependencies and builds React.
2. A .NET SDK stage restores and publishes the C# API with its historical data snapshot and migration.
3. A smaller .NET runtime stage receives the API and frontend build, then runs them as the non-root `app` user.

The final container includes the Node executable for the historical data ingestion worker, but does not run a Node development server or include the .NET SDK. ASP.NET serves both `/api/...` and the compiled React files. The worker fetches catalog updates and selected races, and imported data is stored in PostgreSQL.

## Start it

From the project root:

```powershell
node scripts/setup-env.mjs
docker compose up --build -d
docker compose ps
```

`--build` rebuilds the application image. `-d` runs containers in the background. Compose starts PostgreSQL, waits for its health check, then starts the app. On startup the API applies the versioned SQL migration and seeds the recorded race.

Visit http://localhost:8080 and look for **PostgreSQL connected**.

## Ports and names

- On your Windows machine, PostgreSQL is at `127.0.0.1:55432`.
- Inside the Compose network, the API reaches PostgreSQL as `db:5432`.
- Inside the app container, ASP.NET listens on port `8080`; Compose maps it to your host's `8080`.
- `localhost` inside a container means that container, not your Windows machine or the other container.

We use host port 55432 so the container does not conflict with a system PostgreSQL server using 5432. Change `POSTGRES_PORT` or `APP_PORT` in `.env` if necessary.

## Inspect it

```powershell
docker compose ps
docker compose logs --tail 50 app
docker compose logs --tail 50 db
docker compose exec db psql -U pitwall -d pitwall -c "SELECT id, imported_at FROM replay_sessions;"
docker compose exec db psql -U pitwall -d pitwall -c "SELECT label, elapsed_seconds FROM replay_bookmarks;"
```

Save a moment in the interface, run the second query, and you will see the bookmark in PostgreSQL.

To watch application output continuously, use `docker compose logs -f app`; Ctrl+C exits the log viewer without stopping the app.

## Restart and stop

```powershell
docker compose restart app
docker compose stop
docker compose start
docker compose down
```

`restart app` restarts the API. Your bookmarks remain because they live in PostgreSQL. `stop` pauses running containers without removing them; `start` brings them back. `down` removes the project's containers and network while preserving its named database volume.

Adding `--volumes` to `down` would also delete database storage. Do not use that option unless you intentionally want to erase this project's stored data.

## Fast development

Run only PostgreSQL in Docker, then run React and C# on Windows for faster iteration:

```powershell
docker compose up -d db
./scripts/dev-api.ps1
```

In another terminal, run `cd frontend`, `npm ci`, and `npm run dev`. Open http://localhost:5173.

The PowerShell helper reads the ignored `.env` and builds the API connection string without printing the password. Keep `.env` local. The committed `.env.example` is documentation, not a production credential.

## Common issues

- **Cannot connect to the Docker engine:** open Docker Desktop and wait for the engine to start; `docker info` should contain a Server section.
- **Database authentication fails after editing `.env`:** PostgreSQL's image initializes credentials only when its volume is empty. Editing the file does not change an existing database user's password. Restore the original local password or intentionally update the database user.
- **Port already allocated:** change the corresponding host port in `.env`, then run `docker compose up -d` again.
- **API fails at startup:** inspect `docker compose logs app` and `docker compose logs db`. A configured but unreachable database is a startup error, not a silent switch to temporary storage.
- **Interface says Snapshot mode:** the API has no `ConnectionStrings__Pitwall` setting. Start it through Compose or the database-enabled development helper.

Codex's restricted command session may be unable to access Docker's Windows named pipe even when Docker works from your own PowerShell. That is an access boundary in the session, not evidence that Docker needs reinstalling. The API can still be tested against the database's published TCP port.
