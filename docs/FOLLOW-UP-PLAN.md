# Follow-up plan

The race library is the baseline. The map milestone was implemented on `feature/map-controls`, branching from `feature/race-library`. Completed work and expanded browser coverage are now consolidated in `master`, including the latest GitHub merges into `main`.

## 1. Interactive replay map — implemented

- Zoom, pointer-drag panning, fit-to-circuit, and keyboard camera controls.
- Follow the selected driver while the replay runs; manual camera movement exits follow mode.
- Show/hide individual drivers, all drivers, or the selected comparison pair.
- Choose driver labels and the background grid.
- Save one layout per race in the current browser; switching races must not mix preferences.

Done when playback still works, camera bounds stay valid, visibility/settings survive reload, the map works on mobile, and browser checks pass. These display changes do not alter recorded timing or make the interpolated markers more accurate.

Implemented on `feature/map-controls`: camera bounds/zoom and layout-validation unit tests, plus browser checks for drag panning, follow mode, keyboard/playback isolation, persistence, race isolation, and mobile width. Layouts are currently browser-local, one per race; cloud synchronization and multiple named presets are future scope.

## 2. Better race understanding

First pilot implemented on `feature/recorded-locations`: Monza 2024 uses approximate recorded driver coordinates, clock-aligned playback, bounded smoothing, explicit gaps, an estimate comparison mode, payload revision upgrades, and compressed delivery. Other races remain timing estimates until the pilot is reviewed.

- Measured per-driver position playback where provider location coverage permits it.
- Explicit gaps in telemetry and a clear distinction between measured and interpolated movement.
- Sector annotations, driver trails, and shared comparison views, prioritized after trying the first map controls.
- User accounts and server-saved layouts if cross-device use becomes necessary.

## 3. Custom track workspace — design before implementation

- A separate editor for fictional tracks: control points, start/finish, sectors, and pit-lane geometry.
- Versioned track definitions and validation for closed paths and sensible sector ordering.
- A preview with simple driver markers. Real-race replays keep their recorded circuit identity; custom geometry belongs to a separate simulation workspace.

## 4. Strategy decisions and upgrades — later

- First calibrate pace, tyre degradation, pit losses, and traffic against historical data.
- Then add player decisions, balanced upgrade tradeoffs, and multiplayer seasons.
- Defer car designs, 3D models, visual part upgrades, and detailed upgrade models until the replay/map experience and simulation assumptions are useful and testable.

## Branch and validation workflow

Use a focused feature branch for each milestone, run timing/camera unit tests and browser tests, and review into `develop`. Promote to `master` once the integration branch is ready. Container delivery continues through the existing GitHub Actions workflow.
