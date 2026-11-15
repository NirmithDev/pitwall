# Current automated checks

## Playwright: 15 browser scenarios

| Area | Coverage |
| --- | --- |
| Replay | Play/pause, speed selection, previous/next lap, timeline end, chequered status, restart |
| Bookmarks | Save, reload, revisit, and delete using the real API |
| Library | Season/search filtering, latest cached race, selection surviving reload |
| Ingestion UI | Queue/poll/open flow; failed imports preserve the existing race and permit another selection |
| Recovery | Initial API failure followed by a successful Try again |
| Camera | Drag pan, Ctrl+wheel zoom, bounds, fit/Home reset, keyboard movement |
| Follow | Playback continues while following; manual camera movement exits follow mode without seeking time |
| Map display | Individual visibility, show/hide all, focus pair, labels, grid, defaults, selecting a hidden driver |
| Persistence | Saved camera/display settings survive reload and remain isolated by race |
| Storage failures | Damaged JSON falls back to defaults; saving failures leave playback usable |
| Mobile | Replay/library/map settings stay within a 390-pixel viewport |
| Themes | Light/dark switching, first-visit system preference, persistence across reload/races, mobile dialogs, and blocked preference storage |

These scenarios run against the production frontend build in Chromium. Historical import transitions/outages are mocked so tests do not depend on the external provider. Cached replay data and bookmark CRUD use the C# API. Each Playwright test receives an isolated browser context.

## Other checks

- 17 Vitest checks cover replay timing, track interpolation, camera bounds/zoom, and saved-layout validation.
- Node tests cover historical session filtering and stable session identifiers.
- Python integration checks cover the real API, input validation, race-specific bookmarks, SQL migrations, and PostgreSQL restart persistence.
- GitHub Actions builds the frontend, API, and container and runs the browser suite against bundled data.

## Run locally

From the repository root:

```powershell
dotnet build backend/Pitwall.Api/Pitwall.Api.csproj -c Release
node --test scripts/import-race.test.mjs
cd frontend
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts the API and production-preview server when they are absent. Locally it can reuse running servers; CI starts isolated ones with automatic provider refresh disabled. API integration checks are documented in the README.

## Inspect failures

```powershell
npx playwright show-report
npx playwright show-trace test-results/<failed-test>/trace.zip
```

Failures retain screenshots, videos, and traces. The HTML report is generated for every run. CI uploads the report and any failure evidence as the `browser-test-results` artifact for seven days.

Unit discovery lives in `vitest.config.ts`, preventing shell glob expansion from accidentally running Playwright files under Vitest.
