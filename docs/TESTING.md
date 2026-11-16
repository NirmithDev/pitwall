# Current automated checks

## Playwright: 30 browser scenarios

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
| Recorded locations | Monza's recorded/estimate toggle preserves time; a deterministic dropout hides markers and resumes on a real sample; unavailable races keep estimates explicit |
| Location upgrades | Queued/running/completed upgrades preserve time, camera, focus and bookmarks; failed coverage allows replay and retry; leaving a pending import cannot replace the next race |
| Replay tools | Recorded trails change on seek and stay out of estimate mode; shared links restore paused moments and import uncached races; dialogs contain keyboard focus |
| Named layouts | Save/load after reload, replace by name, delete, replay-time preservation, mobile light-theme width |
| Custom circuit studio | Keyboard editing, undo/redo, pointer dragging, invalid-geometry recovery, rounded-corner changes and persistence, local save/load, validated JSON import/export, moving preview, historical replay isolation |
| Strategy what-if lab | Editable assumptions change results, ordinary numeric typing, scenario save/load, JSON export, insufficient-sample handling, replay isolation, mobile/blocked-storage recovery |

These scenarios run against the production frontend build in Chromium. Historical import transitions/outages are mocked so tests do not depend on the external provider. Cached replay data and bookmark CRUD use the C# API. Each Playwright test receives an isolated browser context.

## Other checks

- 44 Vitest checks cover replay timing, track interpolation, camera bounds/zoom, saved-layout validation, recorded sample lookup/smoothing/gaps/seek behavior, trail clipping, share-link validation, named-layout limits, custom geometry/rounding/import validation, and deterministic strategy math with branch-limited pace sampling.
- Five Node tests cover historical session filtering, stable identifiers, location clock/projection alignment, invalid coordinates, and coverage gaps.
- Python integration checks cover the real API, input validation, race-specific bookmarks, SQL migrations, PostgreSQL restart persistence, and bundled trace ordering/bounds. A real cache upgrade was also checked against the development database to verify bookmark preservation.
- The on-demand Interlagos location job was checked against the live provider: duplicate requests reused one job, 22 traces / 127,688 samples were cached, an existing bookmark remained intact, and the entire payload plus completed location status survived an API restart. This is a manual integration check; CI does not need provider access.
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
