# Three-minute local demo

This demo uses cached Monza data. No provider sign-in is needed to inspect it.

For all controls, save/reset behavior, limits and recovery paths, use the [complete user guide](USER-GUIDE.md).

## Start

From the repository root, run `node scripts/doctor.mjs`. If the frontend/API are built and PostgreSQL is running, use `node scripts/preview.mjs`. Otherwise follow the README's Docker or development setup first. `--snapshot` runs without PostgreSQL, with temporary bookmarks/imports.

Open [Monza at 30 minutes](http://127.0.0.1:5080/?race=monza-2024&t=1800). The header reports v1.3 and the storage indicator shows the current mode.

## Replay and analysis

1. Choose 30-second driver trails, then zoom/follow a driver or seek between laps. Use recorded vs lap-estimate mode to compare the two explicitly labeled sources.
2. Open **Drivers & view**, enable recorded sector markers, and save a named map layout. The reference lap is labeled; gaps never become invented positions.
3. Open **Race analysis desk**. Compare LEC/NOR pace, choose sector comparison, and inspect pit-lane timing. Switch between retrospective and replay-so-far scopes, export CSV, or click a per-lap row to return to the replay.
4. Open **Pace forecast backtest**, find a pit-free sample, and inspect the actual/forecast graph and errors. The exported training rows precede every holdout row.

## Fictional race workspace

1. Open **Custom circuit studio**. Drag a point, change corner rounding, undo/redo and run its simple marker preview.
2. Select **Circuit race sandbox**. Rename drivers, set pace offsets and service durations, and advance one lap. The first driver enters the connected pit lane; another advance completes its visit and rejoins the circuit.
3. Edit pit handles or entry/exit percentages. Invalid crossing routes disable simulation until fixed; undo recovers. Save the circuit/race setup, reload it and export a session JSON.
4. Close the studio. The historical replay is still at its original race/time and retains its own map geometry.

The next session increment also lets you choose **Race distance (laps)**, select **Your driver**, cancel its scheduled call or **Box this lap**, and advance to **FINAL RESULTS**. Live calls preserve time; setup edits reset it. See [the full race-session flow](guide/05-race-sandbox.md#sandbox-08).

## Engineering evidence

- [Testing guide](TESTING.md): 73 frontend unit checks, nine Node checks, 54 browser scenarios, real API/database integration and dedicated storage/room concurrency checks.
- [v1.3 architecture and limitations](V1.3.md): separate recorded/fictional state, independent enrichment, data quality and model assumptions.
- `node scripts/benchmark-replay.mjs`: reproducible lookup-only comparison against v1.2 with correctness assertions.
- GitHub Actions builds and tests the application and container; release branches publish an image. Hosting, accounts and multiplayer are later scope.
