# Current automated checks

## User guide checks

Run `node scripts/check-docs.mjs` from the repository root. CI runs the same check before application builds. It validates the [handbook](USER-GUIDE.md), stable flow IDs, required flow sections, implementation paths, local links/anchors, UI component classification and product-version metadata.

When changing a flow, update its chapter and `docs/flows.json`, then run `node scripts/update-guide-index.mjs` and the checker. Follow [CONTRIBUTING](../CONTRIBUTING.md). Checks catch structural drift; reviewing the steps against actual behavior remains necessary. Documentation-only changes need this check, without repeating unrelated application suites locally.

## Playwright: 57 browser scenarios

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
| Analysis desk | Measured sector/pit views, replay jumps, retrospective vs replay scope, CSV exports, queued enrichment, failure/retry, refresh retaining cached data, mobile light layout |
| Pace backtest | Past/holdout separation in exports, eligible-window search, invalid-window explanations, branch replay jumps, mobile layout |
| Circuit race sandbox | Pit entry/service/exit, running order, driver settings, persistent setup/session export, pit validation and undo, keyboard handles, animation, tab isolation and storage/mobile recovery |
| Race sessions and live calls | Exact finite-race results/frozen clock, reset/distance preservation, cancellation without resetting, entry commitment, next-lap targeting and selected-driver/mobile controls |
| Multiplayer | Two independent guest sessions, readiness, synchronized clock/results, live calls, reload/reconnect, driver/host handover, invalid invitations, mobile leave, real-hub concurrent claim conflicts, token/ownership/host checks, forged-time rejection and guest removal |
| Fictional recruitment | Generated sign/release/scouting fees and persistence, custom point limits, saved seat swaps and applied performance, new multiplayer room copies, mobile/failed-write behavior, stale-tab protection, raw backup and confirmed corrupted-profile recovery |
| Roster/venue integration | Same-window/cross-tab signed-roster availability without resetting an active run, explicit partial sync and per-slot swaps, saved-grid preservation, replay-outline racing, valid pit geometry, new-room hosting and historical replay isolation |
| Sector map | Completed-reference alignment, saved layout preference, no invented coordinates during gaps, hidden markers before coverage or in estimate mode |
| Tool loading | Studio bundle stays deferred until opened; a failed download returns to a usable replay |

These scenarios run against the production frontend build in Chromium. Historical import transitions/outages are mocked so tests do not depend on the external provider. Cached replay data and bookmark CRUD use the C# API. Each Playwright test receives an isolated browser context.

## Other checks

- 78 Vitest checks cover replay timing and indexed boundary/seek behavior, track interpolation, map/layout preferences, recorded sample lookup and sector alignment, trails, share links, named layouts, geometry/rounding/import validation, deterministic strategy math, held-out pace evaluation, sandbox route/service transitions, setup migration, finish timing/frame invariance, result ordering, cancellation/repeat visits and pit-lane finishes. Recruiting checks cover seeded stats/identities, custom constraints, budget/fees/refunds, roster limits, seat swapping, applied settings and storage/revision failures. A committed shared fixture checks browser/server parity for rounded geometry, pit traversal/service/rejoin and finite results.
- `Pitwall.RoomChecks` checks authoritative room physics, frame invariance, validation, concurrent seat claims, host/driver authorization, reconnect, handover, guest removal and departure. It also consumes `data/testing/room-model.json`; fixture changes need review, rather than automatic regeneration to make a failure pass.
- Nine Node tests cover catalog filtering, identifiers, location alignment/quality, measured-sector/pit normalization, local environment parsing, bounded ports and connection-string escaping.
- `Pitwall.StoreChecks` verifies enrichment preservation, downgrade protection, concurrent writes, safe bundle seeding and bookmarks against both in-memory storage and PostgreSQL. It creates uniquely named test rows and removes only those rows.
- Python integration checks cover the real API, input validation, race-specific bookmarks, SQL migrations, PostgreSQL restart persistence, and bundled trace ordering/bounds. A real cache upgrade was also checked against the development database to verify bookmark preservation.
- The on-demand Interlagos location job was checked against the live provider: duplicate requests reused one job, 22 traces / 127,688 samples were cached, an existing bookmark remained intact, and the entire payload plus completed location status survived an API restart. This is a manual integration check; CI does not need provider access.
- Live analysis enrichment added 1,437 Interlagos sector records and 58 pit visits. A hash of all existing location traces and the replay clock origin remained identical, and the verification bookmark survived. Automated checks cover independent enrichment storage and restart persistence without querying the provider.
- GitHub Actions builds the frontend, API, and container and runs the browser suite against bundled data.

## Run locally

From the repository root:

```powershell
dotnet build backend/Pitwall.Api/Pitwall.Api.csproj -c Release
node --test scripts/import-race.test.mjs scripts/local-tools.test.mjs
dotnet run -c Release --project backend/Pitwall.StoreChecks
dotnet run -c Release --project backend/Pitwall.RoomChecks
cd frontend
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts the API and production-preview server when they are absent. Locally it can reuse running servers; CI starts isolated ones with automatic provider refresh disabled. API integration checks are documented in the README.

To use a separately prepared preview without starting/reusing the default ports, set `$env:PITWALL_E2E_BASE_URL='http://127.0.0.1:5084'` to its actual address before invoking Playwright. Use an isolated snapshot/test server for checks, not a friend's running room or personal database. Clear this variable to restore the default harness. SignalR/WebSocket proxying is configured for both Vite development and preview.

## Inspect failures

```powershell
npx playwright show-report
npx playwright show-trace test-results/<failed-test>/trace.zip
```

Failures retain screenshots, videos, and traces. The HTML report is generated for every run. CI uploads the report and any failure evidence as the `browser-test-results` artifact for seven days.

Unit discovery lives in `vitest.config.ts`, preventing shell glob expansion from accidentally running Playwright files under Vitest.

## Manual performance check

`node scripts/benchmark-replay.mjs` compares indexed lookups with the local `v1.2.0` tag on bundled Monza. It asserts equality for 1,000 sampled standings frames and 1,000 interpolated track points, then reports the median of three lookup batches. One local Node 24 run measured 87.83 ms before vs 6.14 ms after for 1,000 frames (14.31×). This is a lookup microbenchmark, not end-to-end browser FPS, and timing is deliberately not asserted in CI.
