# Local three-race championships

[Guide home](../USER-GUIDE.md) · [Recruiting](08-driver-recruitment.md) · [Race sandbox](05-race-sandbox.md)

This cup is a local fictional career loop. It uses the sandbox pace/pit model, keeps a frozen six-driver field and saves one championship per browser origin. Saved round rewards can fund recruiting; driver training, seasons and multiplayer championships are later increments.

<a id="cup-01"></a>
## CUP-01 — Enter a championship with your signed lineup

**What:** Create a three-round cup with your two selected signed drivers and four rivals.

**How:** Sign/select both race seats in **Driver recruitment**, then open **Local championship** in the replay toolbar. Set **Championship name**, **Laps per round** (1–50) and **Base lap seconds** (30–300). Entry is free. Defaults are **Midnight Cup**, three laps and 60 seconds.

**Result and storage:** Creation freezes driver identities, names, colours, pace, service and scheduled pit assumptions for all three rounds. It also records the entering recruiting team's identity for rewards. The four rivals have fixed, differing pace; one has a scheduled visit. Later recruiting purchases, releases, seat changes or resets do not modify an existing cup. Racing itself leaves the recruiting budget unchanged until a completed-round reward is explicitly claimed.

**Recovery and limits:** Missing/incomplete signed seats reject entry without creating a save. Entry is free; there is no training, wage system or automatic income. Rewards are local game credits, not a server-verified competitive economy. Close the panel to manage recruiting, then reopen and create the cup.

<a id="cup-02"></a>
## CUP-02 — Choose the three-round calendar

**What:** Combine existing replay venues and saved custom circuits.

**How:** Set **Round 1 venue**, **Round 2 venue** and **Round 3 venue** to three different entries, then **Create three-race championship**. Options include the starter circuit, saved custom circuits, the current replay and other cached replay sessions. Import additional replays through **Browse races** before opening the cup panel.

**Result and storage:** Each chosen definition, connected pit route and race setup is validated and stored with the cup. Replay outlines are fitted as independent approximate venues. The same six drivers, lap count and base pace apply throughout. Later edits/deletions of saved custom circuits do not alter the frozen cup copies. Different cached sessions are distinct entries even if their circuit name repeats.

**Recovery and limits:** Duplicate entries disable creation. Missing/unsafe replay outlines, failed cache loads or invalid pit geometry reject creation and preserve the previous save. A failed catalog lookup leaves current/saved options available but may leave too few entries; restore the API or save additional valid custom circuits. Reopen the panel to refresh the available list. No provider import is silently started by choosing a venue.

<a id="cup-03"></a>
## CUP-03 — Start, run and make team pit decisions

**What:** Race one round with control over your two team drivers.

**How:** Choose **Begin round [n]**, then **Run championship race** / **Pause championship race**. Set **Race speed** to 1×/5×/10×/25× or **Advance championship lap** by one base-lap duration. Choose **Your driver**, then **Box championship this lap** / **Box championship next lap** or **Cancel championship pit call** before entry.

**Result and storage:** The cup uses the same deterministic movement, service and exact finish model as the local sandbox. Only your two frozen drivers accept player calls; rivals retain their planned settings. Calls preserve positions/clock, and pit entry commits the visit. Finished drivers freeze until every car finishes; every car covers the full distance.

**Recovery and limits:** Advancing a base-lap duration does not guarantee every car completes a lap. Pit/service/finished phases lock calls, and no entry remains after the final eligible entry. Setup/geometry cannot be edited mid-cup. Missing physical tyre/traffic/fuel dynamics remain the sandbox's limits; a pit route spanning the finish uses its mapped crossing.

<a id="cup-04"></a>
## CUP-04 — Read results and championship standings

**What:** Accumulate points and countback across three consecutive rounds.

**How:** Finish the round and read **Round complete**, its classified finish times and awarded points. **Driver standings** and **Team points** update. Use **Begin round [n+1]** after the result saves. After the third result, **Championship complete** replaces further round entry.

**Result and storage:** Places 1–6 earn 25/18/15/12/10/8 points. Your team score sums its two driver scores. Equal points use wins, then second-place counts, thirds and later places, then initial grid order. A round records automatically once, in calendar order, only after all six finish. A saved final result cannot be awarded again by reloading.

**Recovery and limits:** There is no skip, replay-for-more-points or result editing UI. Exact race-time ties retain grid order. Standings are driver standings plus your team total, not a multi-constructor championship. Saved results unlock the explicit reward claim below; points alone do not automatically change recruiting credits.

<a id="cup-05"></a>
## CUP-05 — Save and resume a race or between-round progress

**What:** Keep completed results, standings and an active race checkpoint between visits.

**How:** Use **Save championship checkpoint**, pause the race or close the panel normally. Autosave also checks for changed progress about every two seconds and saves completed-round results immediately. Wait for a **Saved** message before refreshing. Reopen **Local championship** to load the stored cup; use **Load saved championship** to explicitly replace the in-memory view with the saved record.

**Result and storage:** The versioned JSON record contains the frozen calendar/field, classified results and any current clock, positions, pit decisions, visits and finish states. A restored race always opens paused. Normal panel close waits for an in-flight save and saves the latest progress before closing. The historical replay remains at its prior paused time.

**Recovery and limits:** A hard reload, browser crash or closing the tab can lose the last unsaved seconds; there is no unload-time guarantee. Storage is origin/profile local, including port and hostname isolation. One saved cup exists per origin. Server/database restarts do not erase the browser record, but clearing browser storage can. There is no cross-device/account sync or championship multiplayer yet.

<a id="cup-06"></a>
## CUP-06 — Recover from failed saves or another editing tab

**What:** Keep the previous checkpoint intact when saving cannot safely complete.

**How:** Read **Save failed** errors. Restore browser storage access and retry **Save championship checkpoint**. If another tab changes the cup, export unsaved progress if needed, then **Load saved championship**; this replaces the current in-memory progress and resumes paused.

**Result and storage:** A failed write pauses the race, preserves the previous stored record and leaves the latest in-memory state available. A revision/identity check rejects stale writes. Browsers supporting Web Locks serialize writes, while storage events lock stale screens. Begin/run/advance/pit controls remain locked until the failure/conflict is resolved. **Close without saving** explicitly exits despite a failed save.

**Recovery and limits:** Use only one active editing tab. Without Web Locks, revision checks are best effort. Loading the stored cup discards unsaved progress in that view; exported JSON is an inspection record, not a supported import path. Never clear all browser data to repair one cup.

<a id="cup-07"></a>
## CUP-07 — Export a cup or replace it with a new championship

**What:** Keep an inspection record and choose when to replace the saved cup.

**How:** **Export championship JSON** downloads the displayed snapshot, including unsaved progress. **Create another championship → Choose new championship calendar** opens a replacement form. **Replace saved championship** writes the new cup only after its lineup/calendar validates. **Keep this cup** / **Keep current championship** cancels the replacement flow.

**Result and storage:** Replacement changes only the championship key. Recruiting, custom circuit saves, ordinary sandbox setups and multiplayer rooms remain independent. The old cup stays stored until a valid replacement is successfully written. A new cup freezes the then-current selected signed lineup.

**Recovery and limits:** There is no archive list, JSON importer or replacement undo. Claim available rewards before replacing: unclaimed payouts from the old cup become unavailable, and the replacement form shows that total. Already-paid receipts and credits remain with the recruiting team. An exported inspection file is not a supported way to restore claims. Leaving the replacement form without creating a new cup retains the old cup; unsaved old-race progress still needs a checkpoint before a hard refresh.

<a id="cup-08"></a>
## CUP-08 — Recover an unreadable saved championship

**What:** Preserve malformed or unsupported saved data until you explicitly discard it.

**How:** When a save cannot be read, use **Back up unreadable championship** first. **Discard unreadable championship → Confirm discard championship** removes that record, then allows creating a fresh cup.

**Result and storage:** The backup wraps the original raw saved string. Reads and failed creation attempts do not overwrite it. Discard checks that the saved string has not changed since it was shown, so a newer save from another tab is not silently removed.

**Recovery and limits:** Discard has no undo/import UI. If storage itself is unavailable, restore access before retrying; a backup cannot be read from blocked storage. The operation removes only the championship record, not signed drivers or custom circuits.

<a id="cup-09"></a>
## CUP-09 — Claim saved round rewards for recruiting

**What:** Turn completed championship results into recruiting credits.

**How:** Finish/save a round, inspect **Round rewards**, then choose **Claim round [n] reward**. Each saved round pays `200 + 20 × team points` credits. The six-car points schedule means a two-driver payout ranges from 560 to 1,060 credits. Read the **recruiting credits** total and claimed badge; the money is available immediately in **Driver recruitment**.

**Result and storage:** Claiming pauses the local race and first saves any pending championship result. The claim operation rereads the committed cup, validates its owner and completed result, recalculates the payout, then writes recruiting credits and its receipt together in the single team record. The receipt identifies cup, round, points, amount, venue and claim time. Rewards from all completed rounds stay available while that cup remains saved, so claiming before starting the next round is optional.

**Recovery and limits:** Unfinished/unsaved rounds cannot pay. Replacing/discarding the cup makes its unclaimed rewards unavailable. Payout does not scale with lap count or base pace. A newly created cup can earn its own rewards; this is not an anti-farming or tamper-proof server economy. Training remains a later feature.

<a id="cup-10"></a>
## CUP-10 — Retry safely and coordinate reward claims across tabs

**What:** Avoid duplicate payouts and preserve the budget when a write fails.

**How:** Wait for **reward claimed** and its claimed badge. If a reward write fails, restore storage access and retry the same button. If another tab claims first, the current view updates or the pending request reports **already claimed** without adding credits again.

**Result and storage:** The receipt key is cup ID plus round, retained in the same recruiting record as the balance. Claims take the browser's recruiting-team lock and then the championship lock; ordinary recruiting/cup writes use the same respective locks. Simultaneous claims serialize. A repeated claim returns its existing receipt without a new payout or revision. A lost acknowledgement can be retried safely. A failed pre-write/quota attempt leaves both balance and receipt unchanged; no second championship-side paid flag is needed.

**Recovery and limits:** Reward claims require Web Locks support; unsupported environments disable claiming rather than promise safe coordination. One active editing tab is still recommended for race checkpoints. Credits cap at 1,000,000; spend before claiming a payout that would exceed it. All duplicate-proof receipts are retained up to 1,000 claims; reaching that limit rejects new claims instead of silently pruning history. Browser clearing, manual storage edits and external account sync are outside this local guarantee.

<a id="cup-11"></a>
## CUP-11 — Link an older cup and understand team resets

**What:** Preserve existing saves while binding reward ownership to a recruiting identity.

**How:** Cups created with rewards enabled record their entering team ID automatically. For an older saved cup without that field, use **Link older cup to original team**. Both original signed driver profiles must still exist on the current recruiting roster. The link must save successfully before claims unlock.

**Result and storage:** Linking adds the team identity without changing frozen drivers, race progress or results. A linked cup can pay saved completed rounds to that team even if its lineup later changes or profiles are released. A fresh-team reset creates a new identity and clears its old balance/history, so the fresh team cannot reclaim the older linked cup's rewards.

**Recovery and limits:** Already-bound cups cannot be transferred to another team. An unlinked legacy cup whose original profiles are no longer available cannot be safely linked through this UI; keep it for inspection or begin a new cup. Matching team names alone is insufficient. Team exports/backups are inspection records, not an account-recovery/import flow.
