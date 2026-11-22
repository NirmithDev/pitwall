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
| Race distance | 1–50 laps; default ten; old saved setups without this field open as ten laps |

**Result and storage:** Configuration changes pause/reset the simulation clock and grid. Defaults use offsets 0, +2 and −1; only the first driver is scheduled to pit, on lap one, with 2.5-second service. Names/colours do not affect pace. Save to persist the configuration.

**Recovery and limits:** Empty/invalid driver settings block running/saving. Numeric inputs accept incomplete typing and apply bounds on blur/Enter. Scheduled stops at/beyond the finish have no effect. Live calls can add visits; there are no compound or car-part controls yet.

Use **Recruit and manage drivers** for [fictional recruiting and custom stat builds](08-driver-recruitment.md). Applying that lineup replaces the first two grid drivers with derived pace/service settings and restarts this sandbox; it is separate from real players controlling multiplayer seats.

The signed roster also appears directly in each grid slot. [TEAM-09](08-driver-recruitment.md#team-09) covers automatic availability, fresh-grid defaults, partial-lineup sync and swapping existing signed builds. [STUDIO-10](04-circuit-studio.md#studio-10) opens a fictional race on the current replay's circuit outline. New default pit lanes try another short connected route if the initial lane crosses a concave circuit; a saved invalid lane still needs explicit editing/recovery.

<a id="sandbox-03"></a>
## SANDBOX-03 — Attach and edit the pit lane

**What:** Define a connected route that leaves and rejoins the rounded circuit.

**How:** Set **Pit entry (% of lap)** and **Pit exit (% of lap)** from 0–99, at different locations. Choose **Edit pit-lane handles**. Drag orange handles or focus the canvas and use arrows (Shift for larger steps). Click empty canvas to append a handle; select a handle and **Remove pit handle** to remove it. Choose **Finish pit-lane editing** afterward.

**Result and storage:** Entry/exit stay attached to circuit-distance fractions. The curved pit route uses 1–12 interior handles; service is at its route midpoint. Edits pause/reset simulation and are kept in the working setup until saved.

**Recovery and limits:** Self-crossing, circuit-crossing, too-short or invalid routes report errors and block running/saving. Move handles, separate entry/exit, undo, or reset the lane. Appending does not insert at the nearest segment, so inspect the resulting route before running.

<a id="sandbox-04"></a>
## SANDBOX-04 — Run, pause and advance the fictional race

**What:** Observe the configured pace, scheduled/live pit visits and a fixed-distance race finish.

**How:** Choose **Run sandbox** / **Pause sandbox**, set **Preview speed** to 1×, 5×, 10× or 25×, or use **Advance one lap** for a deterministic jump of one base-lap duration.

**Result and storage:** The clock/order/markers advance. Drivers start on a staggered grid, enter the pit lane when scheduled, stop for service and rejoin at the configured exit. Pit speed is fixed at 35% of each driver's synthetic main-track speed. Speed changes do not reset the race; manual advance leaves it paused.

**Recovery and limits:** One base-lap jump does not mean every driver completed exactly one lap; pace and pit visits differ. **GRID**, **TRACK**, **PIT**, **SERVICE** and **FINISHED** labels explain state. Finished drivers stop moving; advance/run disable when everyone finishes. Runtime clock/state is not restored by a saved setup.

<a id="sandbox-05"></a>
## SANDBOX-05 — Undo, reset the lane or reset the run

**What:** Recover without confusing configuration and runtime state.

**How:** Use **Undo sandbox edit** for a recorded configuration change, **Reset pit lane** for default lane geometry, or **Reset sandbox** to restart the current grid/run.

**Result and storage:** Undo uses a bounded in-memory setup history and resets the run. Reset pit lane keeps driver/base settings while restoring default entry/exit/handles. Reset sandbox keeps configuration/distance but resets clock, positions, visits, finish times and live calls; configured scheduled stops return. None is an automatic persistence update.

**Recovery and limits:** This history has no redo button and is not retained after closing. Saving/deleting circuit entries is outside sandbox undo. Resetting a run does not remove a browser-saved setup.

<a id="sandbox-06"></a>
## SANDBOX-06 — Save and reopen a circuit/race setup

**What:** Keep geometry and driver/pit configuration for future visits.

**How:** Choose **Save circuit and race setup**. On a later visit, use the editor's **Saved circuits → Load circuit**, then reopen **Circuit race sandbox**.

**Result and storage:** The circuit definition and its separately keyed setup are saved in this browser origin. Circuit capacity is 20. The setup restores driver/pit assumptions and race distance for that circuit ID, with a fresh run rather than the previous clock/order or live calls. Older v1 setups default to ten laps without losing their other settings.

**Recovery and limits:** A failed setup save does not guarantee all settings were persisted; read its message and retry before closing. Circuit geometry may have been saved before a later setup write failed. There is no separate saved-setup list/delete button. Deleting a circuit does not necessarily purge its keyed sandbox setup.

<a id="sandbox-07"></a>
## SANDBOX-07 — Export a sandbox session

**What:** Download an inspection artifact containing both the circuit and current simulation.

**How:** Choose **Export sandbox session JSON** while the setup is valid.

**Result and storage:** The file contains its sandbox kind/version, circuit geometry, setup/distance, elapsed clock and driver states including queued calls, completed visits and finish times. It does not write server data or save browser settings.

**Recovery and limits:** There is no sandbox-session importer or resume-from-file flow yet. The editor's circuit importer accepts a circuit definition, not this combined session file. Use explicit browser saves to reopen configuration through the current UI.

<a id="sandbox-08"></a>
## SANDBOX-08 — Choose a race distance and read final results

**What:** Run a finite fictional race with deterministic finishing times and order.

**How:** Set **Race distance (laps)** to 1–50 before running (default ten). Use **Run sandbox** or **Advance one lap**. The order panel becomes **FINAL RESULTS** once every driver finishes. Read each driver's finish time in seconds to three decimal places and completed pit visits. Choose **Reset sandbox** for another run.

**Result and storage:** Every driver completes the full distance; this model does not flag lapped drivers early when the leader finishes. Finish times are computed at the exact simulated crossing, including staggered starting positions, pace and pit/service time. Finished drivers freeze, classify ahead of unfinished drivers, and sort by finish time. Exact ties retain grid order. The clock freezes at the last finish instead of the end of a manual time jump. Distance saves with the setup; results remain transient or can be exported.

**Recovery and limits:** Changing setup/geometry restarts the run and discards results. A pit route spanning start/finish uses its proportional mapped circuit crossing, which can happen before service; an unfinished pit visit is not counted as a completed stop. This is a synthetic route model, not a surveyed timing line or regulation simulation. Read the export limitation in SANDBOX-07 before closing.

<a id="sandbox-09"></a>
## SANDBOX-09 — Make and cancel live pit calls

**What:** Change one selected driver's next visit without restarting the race.

**How:** Under **Live pit strategy**, choose **Your driver**. Use **Box this lap** before the next entry; after entry has passed the button becomes **Box next lap**. Read the queued lap in the status message. Choose **Cancel pit call** while the driver is on track to stay out; this can cancel its original scheduled stop too. Once a visit is complete, another live call can schedule a further visit.

**Result and storage:** Calls preserve the clock, running/paused state, other drivers and positions. A live call replaces the selected driver's pending scheduled/live target. At entry the visit locks: pit/service state cannot be cancelled or redirected. Repeated visits use that driver's configured service duration and the same lane/speed. Calls apply while paused or running, including from the grid. They are transient runtime decisions, included in session exports but not setup saves.

**Recovery and limits:** No valid entry remains after the final eligible entry, so the box button disables. Calls also disable during lane editing or invalid setup, and finished drivers cannot receive them. A reset/setup change removes live calls and reinstates configured scheduled stops. There is no undo of a committed visit, tyre choice, race engineer AI or session importer yet.
