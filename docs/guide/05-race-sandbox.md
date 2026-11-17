# Configure and run a fictional race

[Guide home](../USER-GUIDE.md) · [Circuit editor](04-circuit-studio.md) · [Storage and maintenance](06-maintenance.md)

This is a deterministic geometry/pace/service preview. It does not simulate grip, collisions, traffic, overtaking decisions, fuel, tyre rules or vehicle upgrades. Its running order is fictional circuit progress, not a prediction for real drivers.

<a id="sandbox-01"></a>
## SANDBOX-01 — Enter the sandbox and switch studio views

**What:** Use a valid custom circuit for a driver/pit simulation.

**How:** Open **Custom circuit studio**, create/load a valid circuit, then choose **Circuit race sandbox**. Choose **Circuit editor** to return to geometry editing.

**Result and storage:** The views share the current circuit, but simple-preview and sandbox controls are separate. Switching to the editor pauses the sandbox while retaining its unsaved setup for that draft ID. Changing circuit points/rounding resets its simulation; selecting a new circuit ID opens that circuit's own setup/defaults.

**Recovery and limits:** Invalid geometry disables entering race mode. Closing the entire studio discards unsaved drafts/configuration. Switching views is not a save; use the explicit save action below.

<a id="sandbox-02"></a>
## SANDBOX-02 — Configure the grid and driver pace

**What:** Set the fictional participants and planned service visits.

**How:** Set **Base lap (seconds)** and **Drivers**. In each grid slot, edit name, colour, pace offset, pit lap and service seconds.

| Control | Limits / meaning |
| --- | --- |
| Base lap | 30–300 seconds; default 90 |
| Drivers | 1–6; default three |
| Name | 1–24 trimmed characters |
| Colour | A selected hexadecimal colour |
| Pace offset | −10 to +10 seconds added to base lap; negative is faster |
| Pit on lap | 0 = no visit; 1–10 = one scheduled visit on that driver lap |
| Service seconds | 0–15 stationary seconds at the pit route's midpoint |

**Result and storage:** Configuration changes pause/reset the simulation clock and grid. Defaults use offsets 0, +2 and −1; only the first driver is scheduled to pit, on lap one, with 2.5-second service. Names/colours do not affect pace. Save to persist the configuration.

**Recovery and limits:** Empty/invalid driver settings block running/saving. Numeric inputs accept incomplete typing and apply bounds on blur/Enter. There are no compound, car-part, race-length or multiple-stop controls yet.

<a id="sandbox-03"></a>
## SANDBOX-03 — Attach and edit the pit lane

**What:** Define a connected route that leaves and rejoins the rounded circuit.

**How:** Set **Pit entry (% of lap)** and **Pit exit (% of lap)** from 0–99, at different locations. Choose **Edit pit-lane handles**. Drag orange handles or focus the canvas and use arrows (Shift for larger steps). Click empty canvas to append a handle; select a handle and **Remove pit handle** to remove it. Choose **Finish pit-lane editing** afterward.

**Result and storage:** Entry/exit stay attached to circuit-distance fractions. The curved pit route uses 1–12 interior handles; service is at its route midpoint. Edits pause/reset simulation and are kept in the working setup until saved.

**Recovery and limits:** Self-crossing, circuit-crossing, too-short or invalid routes report errors and block running/saving. Move handles, separate entry/exit, undo, or reset the lane. Appending does not insert at the nearest segment, so inspect the resulting route before running.

<a id="sandbox-04"></a>
## SANDBOX-04 — Run, pause and advance the fictional race

**What:** Observe the configured pace and one optional pit/service visit per driver.

**How:** Choose **Run sandbox** / **Pause sandbox**, set **Preview speed** to 1×, 5×, 10× or 25×, or use **Advance one lap** for a deterministic jump of one base-lap duration.

**Result and storage:** The clock/order/markers advance. Drivers start on a staggered grid, enter the pit lane when scheduled, stop for service and rejoin at the configured exit. Pit speed is fixed at 35% of each driver's synthetic main-track speed. Speed changes do not reset the race; manual advance leaves it paused.

**Recovery and limits:** One base-lap jump does not mean every driver completed exactly one lap; pace and pit visits differ. **GRID**, **TRACK**, **PIT**, **SERVICE** and completed-stop labels explain state. There is no automatic fixed-distance finish or live “box now” control. Runtime clock/state is not restored by a saved setup.

<a id="sandbox-05"></a>
## SANDBOX-05 — Undo, reset the lane or reset the run

**What:** Recover without confusing configuration and runtime state.

**How:** Use **Undo sandbox edit** for a recorded configuration change, **Reset pit lane** for default lane geometry, or **Reset sandbox** to restart the current grid/run.

**Result and storage:** Undo uses a bounded in-memory setup history and resets the run. Reset pit lane keeps driver/base settings while restoring default entry/exit/handles. Reset sandbox keeps configuration but resets clock, positions and visits. None is an automatic persistence update.

**Recovery and limits:** This history has no redo button and is not retained after closing. Saving/deleting circuit entries is outside sandbox undo. Resetting a run does not remove a browser-saved setup.

<a id="sandbox-06"></a>
## SANDBOX-06 — Save and reopen a circuit/race setup

**What:** Keep geometry and driver/pit configuration for future visits.

**How:** Choose **Save circuit and race setup**. On a later visit, use the editor's **Saved circuits → Load circuit**, then reopen **Circuit race sandbox**.

**Result and storage:** The circuit definition and its separately keyed setup are saved in this browser origin. Circuit capacity is 20. The setup restores driver and pit assumptions for that circuit ID, with a fresh run rather than the previous clock/order.

**Recovery and limits:** A failed setup save does not guarantee all settings were persisted; read its message and retry before closing. Circuit geometry may have been saved before a later setup write failed. There is no separate saved-setup list/delete button. Deleting a circuit does not necessarily purge its keyed sandbox setup.

<a id="sandbox-07"></a>
## SANDBOX-07 — Export a sandbox session

**What:** Download an inspection artifact containing both the circuit and current simulation.

**How:** Choose **Export sandbox session JSON** while the setup is valid.

**Result and storage:** The file contains its sandbox kind/version, circuit geometry, setup, elapsed clock and driver states. It does not write server data or save browser settings.

**Recovery and limits:** There is no sandbox-session importer or resume-from-file flow yet. The editor's circuit importer accepts a circuit definition, not this combined session file. Use explicit browser saves to reopen configuration through the current UI.
