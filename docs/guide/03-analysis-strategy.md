# Analysis, hypothetical strategy and backtesting

[Guide home](../USER-GUIDE.md) · [Replay/map](02-replay-map.md) · [Circuit editor](04-circuit-studio.md)

These three tools answer different questions. Analysis describes recorded outcomes. Strategy compares assumptions about an alternative plan. Backtesting measures pace-forecast errors on later recorded laps; it does not prove an unobserved pit decision would have worked.

<a id="analysis-01"></a>
## ANALYSIS-01 — Choose drivers and analysis scope

**What:** Open a historical comparison without altering the replay.

**How:** Choose **Race analysis desk**. Set **Analysis driver**, **Analysis comparison** (or no comparison) and **Analysis scope**. **Full race · retrospective** is the default; **Replay so far · completed laps** limits rows to laps finished by the main clock.

**Result and storage:** The tool pauses replay and initializes from the main focus/comparison. Selections stay within this tool visit. Changing them does not change the main focus unless you use a replay jump.

**Recovery and limits:** Early replay scope can have no usable laps. Seek later or deliberately choose full-race scope, which reveals later results. A self-comparison is cleared when selecting the same driver as focus.

<a id="analysis-02"></a>
## ANALYSIS-02 — Interpret pace and stint trends

**What:** Compare recorded durations, median pace and within-stint trends.

**How:** Choose **Lap pace**. Read the median/best/coverage cards, colored lap-time dots and trailing five-usable-lap median lines. Toggle **Include opening, pit and outlier laps** to see excluded rows/dots.

**Result and storage:** The graph/table visibility changes; the usable summary and trend calculations still use their exclusion rules. Median lines restart within each stint. Trend cards show the observed slope and sample count.

**Recovery and limits:** Opening laps, known pit in/out laps, invalid durations and large timing outliers are excluded from usable pace. The filter does not remove every flag/traffic effect. A stint slope is not isolated tyre degradation; fuel, traffic and conditions can affect it. No analysis preferences are saved automatically.

<a id="analysis-03"></a>
## ANALYSIS-03 — Compare measured sectors

**What:** Identify sector-level differences between selected drivers.

**How:** Choose **Sector comparison** and set **Sector comparison lap**. Use a specific lap for same-lap-number comparison, or **Best sectors across usable laps** for separate minima.

**Result and storage:** Cards show S1/S2/S3 values, relative bars, rival-minus-focus deltas and sector sums. Negative rival-minus-focus means the rival's sector was quicker. This view is temporary.

**Recovery and limits:** Missing values stay blank/dashed. Best-sector sums can combine different laps/stints and are not a recorded lap. Complete sector sets that disagree substantially with their lap duration are excluded from best-sector aggregation. Same-lap-number comparisons are not simultaneous on-track gaps.

<a id="analysis-04"></a>
## ANALYSIS-04 — Inspect measured pit visits

**What:** Separate pit-lane traversal from stationary service.

**How:** Choose **Pit-lane timing**. Inspect visits for the focus/comparison drivers and the current analysis scope, including median lane and service durations.

**Result and storage:** Rows show driver, lap, lane duration and stationary service when supplied. The data is part of cached measured analysis, not a simulation input automatically applied to strategy plans.

**Recovery and limits:** A missing stationary duration is not an assumed zero. A measured zero stationary duration is retained as zero. Older sessions may lack stationary measurements. Neither lane nor stationary duration equals net race-time loss against staying on track. A pit-data retrieval warning can coexist with usable sector data.

<a id="analysis-05"></a>
## ANALYSIS-05 — Load or refresh measured analysis

**What:** Enrich a cached replay with measured sectors, speed-trap readings and pit visits.

**How:** In the desk, choose **Load measured analysis** if absent, or **Refresh measured analysis** if cached. Watch the status. After failure use **Retry measured analysis**.

**Result and storage:** A successful job replaces only analysis enrichment. Timing, location traces, playback position, bookmarks and map settings remain. Refresh keeps old charts available until replacement succeeds. PostgreSQL persists enrichment; snapshot mode loses it on API restart. The source and imported time are displayed.

**Recovery and limits:** Timing must already be cached. A full queue/provider outage can fail or delay a job. Closing the dialog stops this browser's wait, not server work. A failed refresh keeps the previous cache. Catalog refresh and location import are separate operations.

<a id="analysis-06"></a>
## ANALYSIS-06 — Inspect rows and jump back to replay

**What:** Connect a measured lap to its replay moment.

**How:** Expand **Per-lap data and replay jumps**. Inspect duration, rival difference, sector values, speed-trap reading, compound/age and data notes. Click the lap number / **Replay lap [number] for [code]**.

**Result and storage:** The desk closes, the main focus changes to that driver and the replay seeks to the selected lap's start, paused. A conflicting comparison is cleared. No bookmark is created.

**Recovery and limits:** The scope and exclusion toggle determine available rows. Rival timing can be missing for that lap. Sector-sum warnings flag inconsistent measurements; they do not silently rewrite the raw values.

<a id="analysis-07"></a>
## ANALYSIS-07 — Export analysis data

**What:** Download data for inspection outside the app.

**How:** Choose **Export driver laps CSV** or **Export analysis JSON**.

**Result and storage:** CSV contains the focused driver's completed rows in the current scope, including exclusion notes and empty missing values; it is not limited to only the clean dots currently shown. JSON includes focus/comparison rows, scope and summary/source information. Downloads go to the browser's chosen download location.

**Recovery and limits:** These exports have no analysis import button. They do not back up bookmarks, browser layouts or the complete database. If downloads are blocked, allow the intended local download and retry.

<a id="strategy-01"></a>
## STRATEGY-01 — Choose the hypothetical branch and horizon

**What:** Start two model plans from a historical driver's sampled pace.

**How:** Choose **Strategy what-if lab**, a driver, **Branch after completed lap**, and **Project next laps**. Branches are between lap 3 and the race's penultimate lap. Horizon is 1–40 laps, bounded by remaining race laps.

**Result and storage:** Replay pauses without seeking. The initial branch uses the focused driver's completed lap when at least five are complete; otherwise it uses lap 10, clipped for shorter races. Initial horizon is up to 20. Changing the branch/horizon can clamp pit laps to fit.

**Recovery and limits:** At least three usable timing samples are needed. Choose a later branch or another driver if calibration is unavailable. The tool can deliberately sample a branch later than the main replay clock; its selected branch is explicit. It does not create a historical replay branch or alter recorded data.

<a id="strategy-02"></a>
## STRATEGY-02 — Edit Plans A and B

**What:** Compare assumed pace, degradation and a single optional stop.

**How:** Change each plan's fields below. Valid values update the model; incomplete typing is allowed, and leaving the field or pressing Enter applies its bounds.

| Field | Range / meaning | Initial value |
| --- | --- | --- |
| Pace adjustment | −5 to +5 seconds on each future lap; negative is faster | 0 |
| Degradation | 0–0.5 extra seconds per lap for each additional lap | 0.06 |
| Pit on future lap | 0 = no stop; otherwise 1 through the chosen horizon | A: 0; B: up to 5 |
| Pit loss | 5–60 seconds added once on the chosen future lap | 22 |
| Fresh tyre gain | 0–5 seconds per lap relative to sampled pace, after the stop | 1.2 |

**Result and storage:** After a stop, incremental degradation resets and fresh-tyre gain starts on the following lap. Pit-loss/gain fields are disabled when pit lap is zero, retaining their values for later use. Changes are temporary until a scenario is saved.

**Recovery and limits:** These are editable assumptions, not automatically measured net pit losses or tyre models. There is one optional stop per plan; no traffic, opponents, fuel, weather, flags, compound regulations or failures are modeled.

<a id="strategy-03"></a>
## STRATEGY-03 — Read the model result

**What:** Compare projected elapsed totals under the supplied assumptions.

**How:** Read Plan A/B totals and the modeled advantage. Inspect the cumulative difference graph, expand **View per-lap projection and calibration laps**, and read **Model assumptions**.

**Result and storage:** The graph plots B minus A: positive means B is slower, negative means B is faster. The per-lap table identifies a modeled pit lap and cumulative totals. Nothing is written to the historical replay.

**Recovery and limits:** Pace is sampled only through the selected branch, from up to 12 recent usable laps after robust filtering. A faster modeled total is not a predicted finishing position or proof of a real counterfactual outcome. Equal assumptions produce equal results.

<a id="strategy-04"></a>
## STRATEGY-04 — Save and load named scenarios

**What:** Reuse a branch, driver, horizon and two sets of assumptions.

**How:** Enter **Scenario name** and choose **Save scenario**. Choose **Saved scenarios → Load scenario** later.

**Result and storage:** Names are 1–48 trimmed characters, with ten slots per race/browser origin. Reusing a name case-insensitively replaces it. Loading restores assumptions and recalculates pace from the current replay data; it does not seek the main replay.

**Recovery and limits:** Save is disabled without a name/calibration. At capacity, replace a name or delete a scenario. Storage failures leave the current comparison usable but unsaved. Closing/reloading loses unsaved assumptions.

<a id="strategy-05"></a>
## STRATEGY-05 — Delete or export a strategy scenario

**What:** Remove a browser save or download the current comparison.

**How:** Select a saved entry and **Delete scenario**, or choose **Export comparison JSON** for the current inputs/results.

**Result and storage:** Delete removes the saved entry but leaves current inputs open. Export includes the driver/branch, plans, calibration, projections, model identifier and limitations.

**Recovery and limits:** There is no scenario trash/undo or JSON scenario importer. Export is a portable inspection artifact, not a one-click restore flow. Keep a browser save when you want to reload through the UI.

<a id="backtest-01"></a>
## BACKTEST-01 — Choose past training and future evaluation laps

**What:** Evaluate simple pace baselines against actual later recorded durations.

**How:** Open **Pace forecast backtest**, choose **Backtest driver**, **Train through completed lap**, and **Held-out future laps**. Branch starts at lap 5; holdout is 1–15 laps within the race's remaining laps.

**Result and storage:** Training uses up to 12 recent usable laps through the branch, restricted to the current stint, with at least five required. The flat forecast uses their median; the trend forecast extrapolates a bounded past slope. The main replay stays paused at its existing time.

**Recovery and limits:** Missing/unusable timing or pit in/out laps make a holdout ineligible. Later recorded durations are used for evaluation only. Changing driver/window is temporary and does not save a scenario.

<a id="backtest-02"></a>
## BACKTEST-02 — Find an eligible sample

**What:** Locate an example that the pace-only diagnostic can evaluate.

**How:** Set driver/holdout size, then choose **Find pit-free sample**. Read the selected branch and any message.

**Result and storage:** The tool chooses the first eligible window it finds; it does not modify data or persist a benchmark selection.

**Recovery and limits:** A driver may have no eligible window; shorten the holdout or choose another. An automatically selected pit-free example is not a representative statistical benchmark.

<a id="backtest-03"></a>
## BACKTEST-03 — Interpret and export forecast errors

**What:** See how the two past-only pace forecasts matched the held-out laps.

**How:** Compare **Mean absolute error**, training/holdout counts, actual-versus-forecast graph and row errors. Read **Method and limits**, then choose **Export backtest JSON** if needed.

**Result and storage:** Absolute error measures miss size; signed error is prediction minus actual (positive = predicted slower). The trend slope is bounded to ±0.5 seconds per lap of change. JSON includes training rows, holdout outcomes and limitations. No automatic backtest history is saved.

**Recovery and limits:** Traffic, fuel, weather and flags can remain. Cumulative lap-time error is not necessarily wall-clock race-time error. This evaluates pace prediction, not a pit strategy that did not actually happen. There is no backtest JSON importer.

<a id="backtest-04"></a>
## BACKTEST-04 — Open the branch in replay

**What:** Inspect the historical moment where training ends.

**How:** Choose **Open branch in replay** when that driver's branch lap exists.

**Result and storage:** The backtest closes, focus changes to the selected driver and the clock seeks to the branch lap's end, paused. No bookmark is created.

**Recovery and limits:** This differs from an analysis row jump, which seeks to a lap's start. Missing branch timing disables the jump; choose another window.
