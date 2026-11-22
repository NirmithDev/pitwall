# Design a custom circuit

[Guide home](../USER-GUIDE.md) · [Analysis/strategy](03-analysis-strategy.md) · [Race sandbox](05-race-sandbox.md)

The studio holds a draft. Saving/exporting is explicit; closing it is not an automatic draft save. Historical timing and circuit geometry are never replaced by studio edits.

<a id="studio-01"></a>
## STUDIO-01 — Start a new circuit or copy an outline

**What:** Create fictional geometry in **Custom circuit studio → Circuit editor**.

**How:** Open **Custom circuit studio**. Edit the starter circuit, choose **New circuit** for a new starter/ID, or **Copy replay outline as draft** when the open race has enough outline points. Enter **Circuit name**.

**Result and storage:** The default is a ten-point **Midnight circuit**, not a blank canvas. An outline copy is fitted with its aspect ratio retained, simplified if necessary to 6–120 separated valid points, and created as an independent draft named **My outline remix**. Copies use zero extra corner rounding to retain the sampled shape; you can change it later. Names are 1–48 trimmed characters.

**Recovery and limits:** Copying an outline does not copy telemetry, drivers or race timing. Validate the new shape before saving. New/copy replaces the working draft; recorded edit history may allow Undo until the studio closes, but explicit saved/exported copies are safer.

<a id="studio-10"></a>
## STUDIO-10 — Race signed drivers on an existing replay circuit

**What:** Use an existing race's approximate circuit outline as a venue for a separate fictional race.

**How:** Open/import a race through **Browse races**, then choose **Race this circuit** in the replay toolbar. The studio opens directly in sandbox mode with a new **[Circuit] [Year] · sandbox** draft. From an existing studio, **Race on [Circuit] [Year]** prepares the open replay's outline and replaces the working draft. Save an edited draft before switching.

**Result and storage:** The new draft has its own ID, fitted outline and fictional sector divisions. A new unsaved grid uses available selected signed drivers automatically. The pit lane is generated and validated separately; concave outlines can choose another short connected entry/exit route. Set base pace, distance and pit plans as desired, run locally, or host this setup in a new multiplayer room. Saving the circuit/race setup is explicit.

**Recovery and limits:** This does not reproduce real driver performance, measured sector boundaries, an official pit lane or the original race distance/time. Base pace and race distance use sandbox defaults. Missing outlines disable the shortcut. Outlines outside 6–5,000 finite samples or unable to simplify safely are rejected; a failed toolbar launch reports the failure and shows an editable starter rather than pretending it is the requested venue. Inspect pit validation and edit a lane if no generated route fits. The historical replay remains paused at its previous time with its recorded geometry/results unchanged.

<a id="studio-02"></a>
## STUDIO-02 — Add, move and remove control points

**What:** Change the circuit shape.

**How:** Drag a point, or select **Selected point** and focus the canvas to use arrows (2 canvas units; Shift = 10). **Add points** lets clicks on empty canvas append points before the closing segment; choose **Finish adding points** to stop. Use **Remove selected point**, Delete or Backspace while the canvas is focused.

**Result and storage:** The closed path updates in the draft. Points are clamped inside the canvas margin. Removing a point recalculates default sector ordering and adjusts the selection.

**Recovery and limits:** A valid circuit needs 6–120 points, neighboring points at least 8 units apart, a sensible enclosed area and no self-intersection/touching. Too few points or a crossed shape blocks saving/export/race mode until repaired. Use Undo after a bad edit.

<a id="studio-03"></a>
## STUDIO-03 — Undo and redo structural edits

**What:** Recover from recorded point/sector/start/draft-replacement edits.

**How:** Use **Undo edit** and **Redo edit**. A completed drag is one recorded edit; a new structural edit clears redo history.

**Result and storage:** The draft snapshot is restored and point selection resets. History is bounded and exists only in the current studio session.

**Recovery and limits:** Name and rounding changes are not independent undo entries; change those values directly if needed. Undo does not reverse a saved-circuit deletion or restore a draft after closing the studio. Saving is separate from undo history.

<a id="studio-04"></a>
## STUDIO-04 — Set start/finish and sector order

**What:** Define the circuit's start and three-sector ordering.

**How:** Choose a point, then **Start / finish at selected point**. Set **Sector 1 ends at point** and **Sector 2 ends at point**.

**Result and storage:** Moving start rotates point order while preserving direction and resets sector ends to approximate thirds. Sector ends must follow start in order: S1, then S2, then finish. They save with the circuit definition.

**Recovery and limits:** Displayed point numbers are one-based; exported `sectorEnds` indices are zero-based. These are fictional sector definitions, not measured sector timings. With rounded corners, control handles define corners while playback follows the rounded path.

<a id="studio-05"></a>
## STUDIO-05 — Round circuit corners

**What:** Replace abrupt point transitions with curved geometry.

**How:** Adjust **Corner rounding** from 0 to 80. Zero keeps sharp corners; the starter value is 28.

**Result and storage:** The displayed path and preview route use the same rounded corners. Tight sections cap local rounding to avoid cutting across nearby edges. Radius saves in the circuit JSON/browser entry.

**Recovery and limits:** A larger slider value need not create the same radius at every corner. Rounded movement is still a geometric preview, not a grip/steering model. Rounding alone does not repair invalid control-point topology.

<a id="studio-06"></a>
## STUDIO-06 — Run the simple marker preview

**What:** Check the circuit's shape and direction before configuring a race.

**How:** Choose **Run preview** / **Pause preview**, set **Synthetic lap (seconds)** from 30–300, and **Markers** from one to six.

**Result and storage:** Constant-speed fictional markers travel by distance along the rounded route. This is separate from the race sandbox's driver/pit settings. Preview playback/configuration is temporary rather than part of the exported circuit definition.

**Recovery and limits:** Invalid drafts disable preview. There are no service stops or driver pace differences here; use **Circuit race sandbox** for those. Switching studio views pauses this simple preview.

<a id="studio-07"></a>
## STUDIO-07 — Save and load a circuit

**What:** Keep a valid circuit for future visits.

**How:** Choose **Save circuit**. Later select **Saved circuits → Load circuit**. You can edit its name/geometry and save again.

**Result and storage:** Up to 20 circuit definitions are stored per browser origin. Save updates the same circuit ID rather than creating a copy just because its name changed. Loading replaces the working draft, stops preview and starts its progress from zero.

**Recovery and limits:** A valid name/geometry/sector configuration is required. A failed storage write is not a save. There is no dedicated **Save as copy** button or automatic reopening of the last unsaved draft. At capacity delete a saved entry or update an existing one.

<a id="studio-08"></a>
## STUDIO-08 — Delete a saved circuit

**What:** Remove a browser-saved circuit definition.

**How:** Select **Saved circuits**, then **Delete circuit**.

**Result and storage:** The list entry is removed; the current draft stays open. A sandbox setup keyed to that circuit ID can remain in browser storage separately.

**Recovery and limits:** There is no circuit trash. If the deleted circuit is still the open draft, save it again to restore the definition. A previously exported circuit with the same ID can also restore geometry through import/save. Deletion is not a complete purge of every associated browser key.

<a id="studio-09"></a>
## STUDIO-09 — Import or export circuit JSON

**What:** Transfer a circuit definition as a file.

**How:** Choose **Export circuit JSON** for a valid draft. For import, choose **Import circuit JSON** and a supported v1 Pitwall circuit file under 100,000 bytes. Review the imported draft, then **Save circuit** to keep it.

**Result and storage:** Export contains version, ID, name, control points, ordered sector indices and corner radius. Old v1 files without radius use 28. Import validates fields/geometry before replacing the draft and does not save automatically.

**Recovery and limits:** Invalid JSON, unsupported schema, bounds, crossings or excessive size leave the current draft intact and report rejection. Circuit files do not include sandbox driver/pit setup. Full sandbox-session, strategy, backtest or analysis exports are different formats and cannot be fed into this circuit importer.
