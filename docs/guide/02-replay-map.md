# Replay, moments and map controls

[Guide home](../USER-GUIDE.md) · [Start/library](01-start-library.md) · [Analysis and strategy](03-analysis-strategy.md)

<a id="replay-01"></a>
## REPLAY-01 — Play, pause and restart

**What:** Advance the historical replay clock.

**How:** Use **Play replay**, **Pause replay** and **Restart replay**. Choose **Playback speed**: 1×, 5×, 10×, 25× or 50×. Space toggles playback when focus is outside form controls and no tool dialog is open.

**Result and storage:** Playback updates classification, focus data, map markers and race-control messages. Restart returns to zero and pauses. At the end, playback stops; pressing Play there starts again from zero. Speed/time are transient unless represented in a share link.

**Recovery and limits:** These are historical events, not a live race. Opening the library, analysis, backtest, strategy lab or studio pauses playback. The share/info views do not necessarily pause it. Missing telemetry does not mean the clock has stopped.

<a id="replay-02"></a>
## REPLAY-02 — Seek by time or lap

**What:** Inspect a different race moment without replaying from the beginning.

**How:** Drag **Race timeline**, use its focused keyboard controls, select a labeled **LAP** jump, or use **Previous lap** / **Next lap**. Outside form controls/dialogs, left/right arrows seek 15 seconds. A focused map uses those arrows for its camera instead.

**Result and storage:** Seeking recalculates state in either direction. Global lap jumps use the earliest recorded start for that lap across drivers; the focused driver's lap can differ from the main lap badge. Seeking itself need not pause existing playback.

**Recovery and limits:** Time is bounded to the replay duration. A missing lap start cannot produce a precise jump. Pause first when you want a stationary inspection.

<a id="replay-03"></a>
## REPLAY-03 — Focus and compare drivers

**What:** Inspect one driver and compare their recent lap/stint information with another.

**How:** Click a classification row or a car marker. Choose **COMPARE WITH**, or **No comparison**. Selecting the current comparison as the focus clears that self-comparison.

**Result and storage:** Driver focus, tyre strip and map emphasis change. A selected hidden driver is revealed on the map. These selections are temporary, but share links encode them.

**Recovery and limits:** Classification follows provider position messages, which can arrive at different times. Last-lap differences may compare different lap numbers; they are not necessarily a simultaneous on-track gap. **NO DATA**/missing timing is not filled with invented laps.

<a id="replay-04"></a>
## REPLAY-04 — Revisit a race-control event

**What:** Jump to a displayed flag/incident/penalty message.

**How:** In **Race control**, click a visible message. Use the replay controls to inspect nearby time before/after it.

**Result and storage:** The clock seeks to that event; it does not create a bookmark. The visible list shows recent messages at or before the replay clock.

**Recovery and limits:** Later events are not all shown in this rolling list. Message time and actual incident onset can differ. Pause before seeking if you do not want playback to continue.

<a id="replay-05"></a>
## REPLAY-05 — Inspect tyre stints

**What:** See the selected driver's compounds and stint lengths.

**How:** Select a driver, then click a segment in **Tyre strategy** to jump to that stint's recorded start.

**Result and storage:** The replay seeks and the playhead follows the focus driver's lap progress. Stints are historical data and do not alter the race.

**Recovery and limits:** The strip deliberately shows full-race stints, including later ones. Missing lap timing can limit the jump. Selecting a stint is not a player pit decision.

<a id="replay-06"></a>
## REPLAY-06 — Save, revisit and delete a moment

**What:** Bookmark the current replay time for this race.

**How:** Choose **Save moment**, then open **Saved**. Click a saved row to seek to it. Use its **Delete [label]** button to remove it.

**Result and storage:** Labels are generated from the current lap/focus; there is no rename field. PostgreSQL bookmarks survive restart. Snapshot bookmarks disappear with the API process. Bookmarks belong to the race and are shared by visitors to this development API, not private accounts.

**Recovery and limits:** Wait for the save result; a failed request is not a saved moment. Deleting has no in-app undo/trash. There is no dedicated bookmark export/import flow. Changing browser origin can retain these server bookmarks while browser-only layouts appear different.

<a id="replay-07"></a>
## REPLAY-07 — Share a replay moment

**What:** Make a link that opens a race at the same time and driver settings.

**How:** Choose **Share moment**, then **Copy replay link** or **Open link ↗**. If clipboard access fails, select the read-only link and copy it manually.

**Result and storage:** The link contains race, elapsed time, driver, comparison, playback speed and position source. Opening it starts paused. A recognized uncached race can queue a timing import before opening. Invalid/out-of-range settings fall back or clamp to available data.

**Recovery and limits:** The dialog captures the moment when opened; playback may continue behind it. Links do not include bookmarks, camera, trails, circuits, scenarios or sandbox state. A localhost address works only on the same computer. Recorded source falls back to estimates if the destination lacks coordinates. This does not publish the app.

<a id="replay-08"></a>
## REPLAY-08 — Read data notes and source limitations

**What:** Understand what is recorded, estimated or hypothetical.

**How:** Open **About this replay** in the header or **Data notes** beside the map. Close with the close button, Escape or its backdrop.

**Result and storage:** The notes explain timing/classification behavior, approximate coordinates and the storage mode. Nothing is saved or changed.

**Recovery and limits:** Recorded coordinates are not lane-accurate GPS. Uniform lap estimates do not establish braking points or physical separation. Strategy projections and fictional circuits are separate from recorded results.

<a id="replay-09"></a>
## REPLAY-09 — Expand the circuit workspace

**What:** Give the replay map more room.

**How:** Choose **Expand circuit view**, then **Restore layout** to return.

**Result and storage:** This changes the surrounding workspace presentation; it does not reset time or change race data. Expansion is temporary and is reset when loading a different race.

**Recovery and limits:** **Restore layout** here means the expanded workspace, not the map's saved camera or named layouts.

<a id="map-01"></a>
## MAP-01 — Choose recorded or estimated positions

**What:** Choose the source used to place car markers.

**How:** Use **Position source → Recorded positions** or **Lap estimate**. Recorded mode is available only when usable traces are cached.

**Result and storage:** Switching preserves the clock/camera and exits follow mode. Recorded mode smooths between nearby retained samples, hiding unsupported gaps. Estimate mode moves uniformly from lap timing. The source selection is not part of saved map layouts; a share link can specify it.

**Recovery and limits:** **Location gap** or a missing marker is a data-coverage result, not an automatic switch to estimated movement. Reopening defaults to available recorded data unless the URL asks for estimates.

<a id="map-02"></a>
## MAP-02 — Load recorded positions

**What:** Upgrade a timing-only replay with approximate driver coordinate traces.

**How:** Choose **Load recorded positions** under the source selector. Watch queued/loading status. A failure provides **Retry recorded positions**.

**Result and storage:** Successful imports update the cache, switch to recorded mode and preserve playback time, driver selection, camera and bookmarks. Playback can continue while loading. PostgreSQL retains the upgrade; snapshot mode does not survive API restart.

**Recovery and limits:** Leaving the race/tool stops the browser wait, not server work. Retry can reconnect. Queue/provider/coverage failures leave the timing replay usable. No usable projection/trace means no recorded upgrade; no coordinates are invented.

<a id="map-03"></a>
## MAP-03 — Zoom, pan and fit

**What:** Move the camera without seeking the race.

**How:** Use **Zoom in/out**, drag the map, or Ctrl/Command + scroll to zoom around the pointer. **Fit circuit** resets the camera. With the map focused, arrows pan, `+`/`−` zoom and Home fits.

**Result and storage:** Zoom is bounded between 100% and 400%; the viewport stays within canvas bounds. Manual movement exits follow mode. Changes remain temporary until a layout is saved.

**Recovery and limits:** Ordinary page scrolling is not map zoom. Camera shortcuts apply to the focused map, while outside it replay arrows seek time. Use Fit if you lose your place.

<a id="map-04"></a>
## MAP-04 — Follow the selected driver

**What:** Keep the camera centered on the focused driver.

**How:** Choose **Follow [code]**. Click it again or move the camera manually to exit following.

**Result and storage:** The view zooms to at least 200% and follows usable positions. A later recorded-location gap holds the previous camera rather than inventing a location. Follow mode itself is temporary.

**Recovery and limits:** Following cannot start when the selected recorded marker has no usable location. Seek to covered time or explicitly choose lap estimates. Hiding that driver exits follow mode.

<a id="map-05"></a>
## MAP-05 — Choose visible drivers

**What:** Reduce map clutter without changing classification or timing.

**How:** Open **Drivers & view**. Toggle individual **Show [code] on map** checkboxes, or use **Show all**, **Focus pair**, and **Hide all**.

**Result and storage:** Only selected markers are rendered; classification remains complete. Selecting a hidden driver as focus reveals it. Visibility is included in saved default/named layouts.

**Recovery and limits:** An intentionally empty map is valid. **Show all** restores visibility. A visible driver may still lack a recorded location at the current time.

<a id="map-06"></a>
## MAP-06 — Set labels, grid and defaults

**What:** Change map presentation.

**How:** Under **Drivers & view**, choose **Driver labels** (focus + comparison, all visible, off), toggle **Background grid**, or choose **Restore defaults**.

**Result and storage:** Defaults restore full driver visibility, the fitted camera, focus labels, grid on and sector markers off. Changes are not persisted until saved as a default/named layout.

**Recovery and limits:** Restore defaults does not delete named layouts. Save afterward if you want those defaults on the next visit. Trails/source/follow are separate temporary controls.

<a id="map-07"></a>
## MAP-07 — Save the default map view

**What:** Set the view used when this race reopens in this browser.

**How:** Adjust camera/visibility/display settings, then choose **Save layout**. If following, the current effective camera is the saved camera.

**Result and storage:** Camera, visibility, label mode, grid and sector preference save for this race and browser origin. The success message confirms storage. This is one default view, independent of named presets.

**Recovery and limits:** Blocked/full storage leaves the current view usable but unsaved. Corrupt preferences fall back to validated defaults. Other hostnames/ports/browsers do not share this save.

<a id="map-08"></a>
## MAP-08 — Save, load, replace or delete a named layout

**What:** Keep several map arrangements for one race.

**How:** Under **Drivers & view**, enter **Layout name** and **Save named layout**. Choose **Saved layouts → Load layout** to apply it, or **Delete layout** to remove that saved entry. Reusing a name replaces its entry case-insensitively.

**Result and storage:** Names are 1–32 trimmed characters; there are ten slots per race/browser origin. Loading changes the view, not replay time, and exits following. Choose **Save layout** afterward to make a named view the default.

**Recovery and limits:** Delete removes the preset without changing the currently displayed view; there is no preset trash. At capacity, delete one or replace an existing name. A failed storage write does not count as a save/delete.

<a id="map-09"></a>
## MAP-09 — Display recorded driver trails

**What:** See recent recorded movement for the visible focus/comparison pair.

**How:** In recorded mode choose **Driver trails → 15, 30 or 60 seconds**, or **Off**.

**Result and storage:** Trails reconstruct from the replay clock, split at unsupported gaps and contain no future points after a backward seek. The choice is temporary, not stored in map layouts.

**Recovery and limits:** Trails are disabled/hidden in lap-estimate mode. Hidden drivers and absent coverage do not produce trails. They are not braking/velocity telemetry.

<a id="map-10"></a>
## MAP-10 — Display approximate sector crossings

**What:** Place S1/S2 annotations using recorded sector clocks and approximate coordinates.

**How:** Load measured analysis if needed, select recorded positions, then enable **Drivers & view → Recorded sector markers**.

**Result and storage:** A label identifies the first suitable completed reference lap for the focus driver. Both crossings require consistent measured sectors and supported coordinate lookups. This preference is saved with layouts.

**Recovery and limits:** Before a suitable lap completes, during unsupported gaps, or without analysis, no invented crossings appear. Markers disappear in estimate mode. These are approximate crossing coordinates, not surveyed sector boundaries.
