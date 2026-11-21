# Follow-up plan

The race library is the baseline. The map milestone was implemented on `feature/map-controls`, branching from `feature/race-library`. Completed work and expanded browser coverage are now consolidated in `master`, including the latest GitHub merges into `main`.

## 1. Interactive replay map — implemented

- Zoom, pointer-drag panning, fit-to-circuit, and keyboard camera controls.
- Follow the selected driver while the replay runs; manual camera movement exits follow mode.
- Show/hide individual drivers, all drivers, or the selected comparison pair.
- Choose driver labels and the background grid.
- Save one layout per race in the current browser; switching races must not mix preferences.

Done when playback still works, camera bounds stay valid, visibility/settings survive reload, the map works on mobile, and browser checks pass. These display changes do not alter recorded timing or make the interpolated markers more accurate.

Implemented on `feature/map-controls`: camera bounds/zoom and layout-validation unit tests, plus browser checks for drag panning, follow mode, keyboard/playback isolation, persistence, race isolation, and mobile width. v1.2 adds multiple named presets per race. Layouts remain browser-local; account synchronization is future scope.

## 2. Better race understanding

First pilot implemented on `feature/recorded-locations`: Monza 2024 uses approximate recorded driver coordinates, clock-aligned playback, bounded smoothing, explicit gaps, an estimate comparison mode, payload revision upgrades, and compressed delivery.

The next increment on `feature/location-imports` adds on-demand upgrades for other races: queued imports, duplicate-request reuse, retryable failures, PostgreSQL caching, and automatic source switching while retaining replay time, driver focus, camera, and bookmarks. Coverage still depends on the provider. Timing-only imports cannot overwrite a richer cached replay. Browser scenarios use deterministic queued/running/completed and failure fixtures.

- Measured per-driver position playback where provider location coverage permits it.
- Explicit gaps in telemetry and a clear distinction between measured and interpolated movement.
- Sector annotations, driver trails, and shared comparison views, prioritized after trying the first map controls.
- User accounts and server-saved layouts if cross-device use becomes necessary.

v1.3 implements the analysis desk, independently cached measured sectors/pit visits, CSV/JSON exports, observed stint trends and approximate map sector crossings from completed reference laps. Full-race retrospective and replay-only scopes are explicit. Missing measurements remain missing. See [the v1.3 guide](V1.3.md).

## 3. Custom track workspace — first studio implemented in v1.2

- A separate editor for fictional tracks: control points, start/finish, sectors, and pit-lane geometry.
- Versioned track definitions and validation for closed paths and sensible sector ordering.
- A preview with simple driver markers. Real-race replays keep their recorded circuit identity; custom geometry belongs to a separate simulation workspace.

The v1.2 studio implements local save/load, validated JSON import/export, draggable and keyboard-editable control points, undo/redo, start/finish and ordered sectors, and adjustable rounded corners. v1.3 adds a connected editable pit lane, a one-to-six driver grid with pace/service settings, deterministic service stops and rejoining, simulated order, and browser-saved race setups. Cloud storage, physical vehicle dynamics and realistic racing lines remain future work.

## 4. Strategy decisions and upgrades — exploratory model in v1.2; richer simulation later

- First calibrate pace, tyre degradation, pit losses, and traffic against historical data.
- Then add player decisions, balanced upgrade tradeoffs, and multiplayer seasons.
- Defer car designs, 3D models, visual part upgrades, and detailed upgrade models until the replay/map experience and simulation assumptions are useful and testable.

The v1.2 lab is an explicit deterministic comparison of two plans for one driver, sampled from recorded laps up to a chosen branch point. Users control pace adjustment, degradation, pit lap/loss and fresh-tyre gain; results include a cumulative difference plot, per-lap totals, local saved scenarios and JSON export. It does not model opponents, traffic, fuel, flags, weather, regulations or finishing positions. Historical validation and a physical/multi-driver model are still required before calling it a race predictor.

v1.3 adds held-out pace-baseline evaluation: past-only training within the current stint, later recorded evaluation laps, missing/pit-window exclusions and visible prediction errors. This is a first diagnostic for pace assumptions, not validation of counterfactual pit decisions.

The first v1.4 increment implements finite fictional sessions (1–50 laps), deterministic finishing order/times, live selected-driver pit calls, cancellation before entry and repeat visits. See [the current sandbox guide](guide/05-race-sandbox.md). Next increments: explicit game-model tyre tradeoffs, a balanced upgrade budget, then complete session save/resume. These are planned; current setup saves do not restore runtime.

The private-room increment adds a server-owned C# simulation, SignalR guest connections, exclusive driver claims/readiness, shared host controls, live calls, spectator support, reconnect and explicit driver/host handover. See [multiplayer flows](guide/07-multiplayer.md). Room storage is in memory, independent of PostgreSQL; public hosting, durable room recovery and multiple-instance coordination remain future scope.

## Branch and validation workflow

Use a focused feature branch for each milestone, run timing/camera unit tests and browser tests, and review into `develop`. Promote to `master` once the integration branch is ready. Container delivery continues through the existing GitHub Actions workflow.
