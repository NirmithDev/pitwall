# Fictional driver recruitment and builds

[Guide home](../USER-GUIDE.md) · [Local sandbox](05-race-sandbox.md) · [Multiplayer](07-multiplayer.md)

Recruitment manages fictional driver profiles. It is separate from real players claiming multiplayer seats. Ratings and credits are local game values; no real money, accounts, training, contracts or season rewards are implemented.

<a id="team-01"></a>
## TEAM-01 — Open and initialize your team

**What:** Create a browser-local team with a budget, prospect market and roster.

**How:** Open **Driver recruitment** from the replay toolbar, or **Custom circuit studio → Circuit race sandbox → Recruit and manage drivers**. The sandbox pauses when opening its manager. Read your credits and roster count at the top.

**Result and storage:** A fresh team starts with 12,000 credits, six generated prospects, an empty six-driver-capacity roster and two unassigned race seats. Claimed championship rewards can grow the balance above the starting amount, up to 1,000,000 credits. The first successful initialization saves that market; reopening does not reroll it. The same team is shared across fictional circuits on this browser origin. An unsaved custom-driver draft is separate from the saved team.

**Recovery and limits:** Storage errors show a warning; unreadable existing data is not silently replaced. **Load latest team** rereads saved state without changing the custom draft or current race. Different browsers/profiles, schemes, hostnames and ports have separate teams. There is no server-synchronized budget or competitive economy verification.

<a id="team-02"></a>
## TEAM-02 — Scout generated prospects

**What:** Compare randomly generated fictional names, colours, stats, fees and effective race settings.

**How:** Inspect **Scout market** cards. Each shows overall rating, pace, consistency, pit discipline, derived pace offset/service duration and signing fee. **Scout new market · 250 credits** replaces all unsigned prospects with another six.

**Result and storage:** Each prospect stat is an integer from 45–90. A saved seed/generation gives a stable market between visits; scouting generates the next market and spends 250 credits only after the save succeeds. Signed drivers and lineup stay intact. Overall is the rounded arithmetic mean of the three stats, not a race prediction.

**Recovery and limits:** Scouting disables below 250 credits. Replaced prospects cannot be recovered through undo. Signing removes a prospect from that market; when it is empty, scout another. Random generation belongs to the market, not per-frame race movement or changes to a signed driver's ratings.

<a id="team-03"></a>
## TEAM-03 — Sign and release roster drivers

**What:** Spend a limited budget on up to six signed drivers.

**How:** Choose **Sign [name] · [fee] credits**. The prospect moves to **Your roster**. **Release [name] · +[refund]** removes a signed driver and returns the displayed amount. A roster driver outside the two selected seats is a reserve.

**Result and storage:** Signing deducts the fee and saves the roster/market/budget together. A signing fills the first empty selected race seat automatically; further signings become reserves when both are occupied. The fee is `500 + round((pace² × 0.45 + consistency² × 0.25 + pitDiscipline² × 0.15) / 25) × 25`. Release refunds 40% of that driver's signing fee, rounded down, and clears its selected seats. Release does not return a driver to the market. Existing race copies retain that driver until replaced.

**Recovery and limits:** Insufficient funds or a full roster disable signing. Re-signing a removed market ID is rejected. Signed names must be distinct ignoring case. Releases are immediate and have no undo; the refund is smaller than the signing cost. Spend credits first if a release refund would exceed the 1,000,000-credit cap. There are no recurring wages; saved championship rewards provide explicit race income.

<a id="team-04"></a>
## TEAM-04 — Build and sign a custom driver

**What:** Choose your own stat tradeoffs, name and colour.

**How:** In **Build a custom driver**, set a name (1–24 trimmed characters), colour and integer stats from 10–100. Use at most 210 total stat points; the default is 70 in each stat. Inspect the point total, fee and effective settings, then **Create and sign custom driver**.

| Stat | Current model effect |
| --- | --- |
| Pace | 60% of the weighted pace rating |
| Consistency | 40% of the weighted pace rating; a steady modifier, not random lap variation |
| Pit discipline | Service seconds = `5 − stat × 0.04` |

**Result and storage:** Pace offset is `(70 − (pace × 0.6 + consistency × 0.4)) × 0.12`, rounded to hundredths of a second/lap; negative is faster. Service is also rounded to hundredths. Custom stat limits give offsets from −3.60 to +7.20 seconds/lap and service from 1.00–4.60 seconds. Successful creation charges the same fee formula as the market and saves the signed profile. Each created driver gets its own identity.

**Recovery and limits:** Over-budget points, insufficient credits and full rosters disable signing; invalid/duplicate names are rejected. You may leave stat points unused for a cheaper build. Ratings of signed drivers are fixed in this version; editing the builder creates another profile. Closing loses the unsaved draft. These stats do not simulate tyre wear, mistakes, traffic or physical vehicle dynamics.

<a id="team-05"></a>
## TEAM-05 — Select and swap race seats

**What:** Choose two different signed drivers for the next fictional lineup.

**How:** Set **Race seat 1** and **Race seat 2**. Selecting the driver already occupying the other seat swaps their assignments. With two assigned seats, **Swap race seats** reverses them directly. Choose **Choose signed driver** to clear a seat.

**Result and storage:** Assignments save with the team, preserving profiles, stats and credits. Swapping affects the selected lineup only; it does not alter a running sandbox or an existing multiplayer room. Remaining roster drivers stay in reserve.

**Recovery and limits:** Unsigned drivers cannot occupy seats and one driver cannot occupy both. Releasing a selected profile clears its seat. Assign both seats before applying. This is fictional lineup selection; real-player control handover is documented in [ROOM-06](07-multiplayer.md#room-06).

<a id="team-06"></a>
## TEAM-06 — Apply recruited builds and host them in a new room

**What:** Turn your selected profiles into a race grid with their derived performance.

**How:** Open the manager from **Recruit and manage drivers** inside the sandbox. Assign two seats and choose **Apply lineup and restart sandbox**. Inspect grid slots 1–2, then run locally or use **Host this setup with friends** to create a multiplayer copy. Use **Save circuit and race setup** if you also want that grid stored with the circuit.

**Result and storage:** Applying copies names, colours, identities, pace offsets and service times into the first two grid slots. It retains those slots' scheduled pit laps (new slots use no scheduled stop), geometry, distance and other opponents. A one-driver grid grows to two. Duplicate copies of a selected recruited ID in later slots are removed. Applying resets clock, positions, live calls and results through the normal setup-change flow. The manager closes; sandbox undo can restore the previous grid.

**Recovery and limits:** Applying requires both signed seats and no unresolved stale/storage warning. It does not automatically save the circuit setup. Existing multiplayer rooms keep their frozen definitions, ownership and current race; only a newly created room receives the changed lineup. Room validation bounds the copied pace/service settings but does not verify browser-local recruiting credits or ratings. Manual sandbox edits can subsequently override copied values.

<a id="team-07"></a>
## TEAM-07 — Recover from storage failures or another tab's changes

**What:** Avoid silently losing purchases or overwriting a newer team.

**How:** Read warnings and use **Load latest team** before retrying a stale transaction. If storage is blocked, restore permission/access and retry. **Back up stored team data** downloads a wrapper containing the raw saved string when a warning is present, if storage can be read.

**Result and storage:** Successful operations save one versioned team JSON record. UI credits/roster change only after storage accepts that record. A saved revision/identity check rejects stale writes. Browsers with Web Locks serialize recruiting transactions across tabs; a storage event also warns open screens about external changes.

**Recovery and limits:** Failed writes leave the displayed previous budget and roster intact. Without Web Locks, revision checks are best effort; use one active recruiting tab. **Load latest team** keeps the unsaved custom draft. Unreadable storage displays a fresh fallback with a warning but cannot overwrite the old record through an ordinary purchase. Backups/exports are inspection files, not automatically restorable through the app.

<a id="team-08"></a>
## TEAM-08 — Export a record or explicitly start fresh

**What:** Download the displayed team or reset your local recruiting progress.

**How:** **Export team JSON** downloads the currently displayed team, including seed/market, roster, lineup and credits. **Start fresh team** opens an explanation; **Confirm fresh team** replaces saved recruiting data with a new 12,000-credit team, or **Keep current team** cancels.

**Result and storage:** A confirmed reset replaces this browser origin's recruiting record, including reward receipts, and creates a new team identity. Existing circuits, local race grid copies, championship definitions and multiplayer rooms remain separate. The fresh identity cannot claim rewards from an older linked cup. Resetting does not save or clear those copies. If you are viewing an unreadable saved record's fallback, back up the raw stored data before resetting; exporting the displayed fallback does not recover the old record.

**Recovery and limits:** There is no team importer or reset undo. A failed reset write retains the old record and reports an error. Other recruiting tabs must load the latest team after a reset. Credits are fictional, so a fresh-team reset is allowed; this is not a protected online economy.

<a id="team-09"></a>
## TEAM-09 — Sync signed drivers directly into a sandbox

**What:** Access the signed roster from the race grid without reopening recruitment or assembling a full two-driver team.

**How:** Inspect **Signed team drivers** in the sandbox. Signings/releases/seat selections update its available roster in the same window or another tab. Use **Sync team lineup and restart** to apply all available selected seats, or choose a profile from **Signed driver** in an individual grid slot. One signed/selected driver is enough for this flow.

**Result and storage:** New unsaved grids automatically use available selected team seats; a stored circuit/race setup retains its own grid until explicitly synced. Signing itself never resets a running race. A grid selection copies the profile's name, colour, derived pace and service duration. Choosing a build already in another slot swaps the builds while keeping each slot's planned pit lap. Sync/selection records ordinary sandbox undo history and restarts its local run; geometry, base pace and distance stay intact. Selecting team seat two can grow a one-driver grid to two.

**Recovery and limits:** Save circuit/race setup separately to persist a copied grid. Unreadable roster storage disables selection/sync while leaving the manual grid usable. Releasing a profile removes it from available choices but does not erase an already copied grid driver. Existing multiplayer rooms keep their frozen driver definitions. Shared browser storage does not synchronize across devices or different origins/profiles.

<a id="team-10"></a>
## TEAM-10 — Inspect championship earnings and spend prize credits

**What:** See claimed race income alongside the recruiting budget.

**How:** Claim a completed-round reward in **Local championship**, then open **Driver recruitment → Championship earnings**. Read total claimed credits/count and the latest ten receipts. Use the updated balance for ordinary market signings, custom builds or scouting.

**Result and storage:** Every receipt remains in the versioned team JSON (up to 1,000); showing only ten does not delete older duplicate-proof IDs. Exports include the receipts. Older team saves without a receipt field read as an empty history while retaining roster, lineup, market and credits; the next successful save stores the normalized field. Rewards update an open sandbox/recruiting view through normal team notifications; stale recruiting writes still fail revision checks rather than erase income.

**Recovery and limits:** Receipt totals are gross claimed income, not a complete spending ledger or current balance. Purchases/releases still change the balance normally. Training and a full transaction history remain later work. Team reset clears the recruiting record and changes its identity; it does not grant ownership of previously entered championships.
