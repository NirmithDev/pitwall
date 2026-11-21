# Private multiplayer races

[Guide home](../USER-GUIDE.md) · [Local sandbox](05-race-sandbox.md) · [Storage](06-maintenance.md)

Rooms run a shared fictional race on the C# server. This is separate from historical replay and from the local sandbox. SignalR delivers snapshots; browsers send decisions rather than positions or time.

<a id="room-01"></a>
## ROOM-01 — Create a private race room

**What:** Host a shared copy of a fictional circuit and setup.

**How:** Open **Multiplayer rooms** in the replay toolbar. Enter **Guest name**, optionally choose a saved circuit, then **Create private room**. To use a draft and its current driver/pit/distance settings, open **Custom circuit studio → Circuit race sandbox → Host this setup with friends** instead. Creating from the main toolbar uses the starter circuit or the selected circuit's browser-saved setup.

**Result and storage:** The server validates and freezes the room's geometry/setup. Subsequent local edits do not change that room. You become host; no driver is automatically claimed. The local sandbox pauses when opening its room panel. Room creation does not save a circuit or overwrite the local run.

**Recovery and limits:** Invalid geometry/settings reject creation. Rooms allow 1–6 driver seats, twelve guests including spectators/offline guests, and 32 rooms per API process. Create/join requests are limited to twenty per minute per IP. A rejected request leaves the existing editor/replay intact; retry after the stated error or limit clears. Guest names are 1–24 characters, independent of driver names.

<a id="room-02"></a>
## ROOM-02 — Invite friends and join as a guest

**What:** Join one shared race from separate browser sessions.

**How:** Copy **Invite friends**, or send the twelve-character room code. The invitation opens the room panel automatically. Enter a guest name and **Join room**. Alternatively open the toolbar's room panel and enter its **Room code**. Wait for **Connected** before making decisions.

**Result and storage:** The server issues a private guest token, stored in this tab's session storage. Invitation URLs contain only the room code. A new guest begins as a spectator and sees current state, including an already-running or finished race. The same guest name can belong to different people; the server uses IDs/tokens for identity.

**Recovery and limits:** An invitation is access to this private room; anyone holding it can join while capacity permits. An unavailable/expired room shows an error and allows creating another. A localhost invitation works only on the host computer. For two local players, use separate browsers/profiles or fresh tabs without a copied guest session. Duplicating a tab can clone its session storage and therefore its guest identity.

<a id="room-03"></a>
## ROOM-03 — Claim a driver, spectate and get ready

**What:** Reserve exclusive control of a driver while sharing the race with others.

**How:** Choose **Claim [driver]**, then **Ready to race**. All claimed drivers must be connected and ready before the host can **Start shared race**. **Not ready** reverses readiness in the lobby. Leave all seats unclaimed to spectate.

**Result and storage:** A guest owns at most one seat; claiming another free driver releases the previous seat and clears readiness. Concurrent claims are serialized by the server: exactly one wins. Unclaimed drivers still follow their configured pace and scheduled stops. You may claim a free seat mid-race and take over its current state; mid-race resume does not require another ready check.

**Recovery and limits:** Claimed seats cannot be stolen. Ask the owner/host to release or hand over one. Disconnected guests keep their seats until they reconnect, explicitly leave, or the host releases/removes them. The host receives a clear error if starting before the readiness requirements are met. Setup edits are unavailable inside a room; create a new room for a different setup.

<a id="room-04"></a>
## ROOM-04 — Make shared live pit decisions

**What:** Make pit calls for your driver in one authoritative race.

**How:** Under **Your strategy**, use **Box this lap** or **Box next lap**, and **Cancel shared pit call** before entry. Read the queued lap or committed phase. Spectators must claim a driver first.

**Result and storage:** The server advances one clock and validates ownership and entry timing. Every guest receives the same order, pit state and exact finishing times. Calls preserve the shared clock and other cars. Repeated visits use the configured service duration. Race distance and mapped pit-lane finishes follow [SANDBOX-08](05-race-sandbox.md#sandbox-08); every driver completes the full distance.

**Recovery and limits:** Pit/service and finished states lock calls. Calls after entry target the next eligible lap; no remaining entry disables the action. Connection loss locks controls while showing the last received snapshot. Decisions are acknowledged once and are not automatically replayed after a reconnect; check the returned authoritative state if a connection drops during a call. The server caps decision bursts at twenty per second per guest.

<a id="room-05"></a>
## ROOM-05 — Control the race as host

**What:** Start, pause, resume, reset and change shared speed.

**How:** Use **Start shared race**, **Pause shared race**, **Resume shared race**, **Reset shared race**, and **Shared speed** (1×/5×/10×/25×). To appoint a new host, select a connected **Handover recipient**, then **Transfer host role**.

**Result and storage:** Host controls affect every guest. Reset pauses at the grid, clears pit decisions/visits/results and readiness, reinstates configured scheduled stops, and keeps current seat ownership. Host transfer retains the race and removes the previous host's host-only controls. Final results and clock freeze once all drivers finish.

**Recovery and limits:** The server rejects host commands from other players even if they bypass the UI. Disconnecting reserves the host role for reconnect; it does not automatically promote another guest. Transfer before an intended handoff, or reconnect to manage the room. Ordinary simulation updates are about ten per second; prolonged server stalls can slow the game clock rather than jump ahead.

<a id="room-06"></a>
## ROOM-06 — Hand over a driver without resetting

**What:** Let another guest take over an existing car during a race.

**How:** Select a connected **Handover recipient**, then **Hand over [driver]**. The owner can hand over its own seat; the host can hand over or **Release [driver]** for any seat. The recipient must release its existing driver first.

**Result and storage:** Position, elapsed clock, pit commitment, queued call, completed stops and finish result stay with the driver. Ownership changes atomically. The previous owner becomes a spectator and loses permission to make that driver's pit calls immediately.

**Recovery and limits:** Offline recipients and guests already owning another seat are rejected. A handover does not cancel a committed pit visit or restart the race. Host role and driver ownership are separate; transfer both explicitly if required.

<a id="room-07"></a>
## ROOM-07 — Reconnect, leave and remove guests

**What:** Recover a guest identity or deliberately release it.

**How:** Reopen the room panel or refresh the same tab to restore its saved guest token. Temporary network loss triggers automatic reconnect attempts; after those stop, use **Reconnect room**. **Leave room and release seat** removes your membership. The host's **Remove [guest]** releases its seat and invalidates its token, including other connected tabs using it.

**Result and storage:** Reconnect fetches a full current snapshot and restores host/driver rights without resetting the race. Closing the panel disconnects but reserves membership; the server race continues. Explicit host departure promotes a remaining connected guest first, otherwise another remaining guest. Leaving the final membership deletes the room. Rooms expire after two hours without connected guests or decisions. API restarts lose all rooms in both database and snapshot modes.

**Recovery and limits:** Browser session storage is scoped to a tab and origin. If it is blocked, a warning says to keep the tab open; after losing the token, join as a new guest and ask the host to release/remove the old membership. **Forget guest session** clears only this tab's credential; it does not remove an unreachable server membership. Removed/left tokens cannot reconnect. There is no account recovery, room save/resume or durable room history yet.

<a id="room-08"></a>
## ROOM-08 — Run a two-player trial and prepare outside access

**What:** Separate local multiplayer testing from public hosting.

**How:** Locally, create a room in one browser, open its invite in a fresh second browser/profile, claim different drivers, mark both ready, and start. Watch both clocks/order, try a pit call, refresh one guest, then test a handover. Keep both using the same server address. For a prepared isolated test preview, set `PITWALL_E2E_BASE_URL` before Playwright; otherwise the standard test configuration starts its own servers.

**Result and storage:** The same API process owns every room's time/state. The Docker image includes the room service. Development/preview proxies forward the SignalR endpoint and WebSockets. A public host needs an HTTPS address and reverse proxy supporting SignalR traffic/WebSocket upgrades; local loopback bindings alone are not accessible to friends on other computers.

**Recovery and limits:** Public deployment is not configured by creating a room. Run one API instance for this prototype; adding replicas without shared room coordination splits races. PostgreSQL does not preserve these in-memory rooms. Platform restarts/redeploys end races, so do them between sessions. Hosting/domain/provider setup remains a separate deployment step. See the [official SignalR client reference](https://learn.microsoft.com/en-us/aspnet/core/signalr/javascript-client?view=aspnetcore-10.0) for transport/reconnect details.
