import { useEffect, useMemo, useRef, useState } from "react";
import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from "@microsoft/signalr";
import Dialog from "./Dialog";
import { request } from "./api";
import { newTrack, readTracks, type CustomTrack } from "./custom-track";
import { nextPitEntry, pointOnRoute, previewPoint, readSandbox, sandboxGeometry, type SandboxSetup, type PreviewState } from "./sandbox";
import { formatClock } from "./race";

type Ticket = {code: string; playerId: string; token: string};
type Player = {id: string; name: string; connected: boolean; ready: boolean};
type Room = {
  code: string; revision: number; hostId: string; track: CustomTrack; setup: SandboxSetup;
  players: Player[]; seats: {driverId: string; playerId: string | null}[];
  states: PreviewState[]; order: string[]; elapsed: number; running: boolean; speed: number; complete: boolean;
};
const key = (code: string) => `pitwall.room.${code}`;
function savedTicket(code: string): Ticket | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key(code)) ?? "null");
    return value?.code === code && typeof value.playerId === "string" && /^[A-F0-9]{64}$/.test(value.token) ? value : null;
  } catch { return null; }
}
function initialCode() {
  const code = new URLSearchParams(location.search).get("room");
  if (code !== null) return code.toUpperCase().slice(0, 12);
  try { return sessionStorage.getItem("pitwall.room.last") ?? ""; } catch { return ""; }
}
export default function MultiplayerRooms({onClose, initialTrack, initialSetup}: {
  onClose: () => void; initialTrack?: CustomTrack; initialSetup?: SandboxSetup;
}) {
  const [code, setCode] = useState(initialCode);
  const [ticket, setTicket] = useState<Ticket | null>(() => savedTicket(initialCode()));
  const [name, setName] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState("Disconnected");
  const [error, setError] = useState("");
  const [storageNote, setStorageNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [recipient, setRecipient] = useState("");
  const hub = useRef<HubConnection | null>(null);
  const [tracks] = useState(readTracks);
  const [track, setTrack] = useState(initialTrack ?? newTrack);
  const setup = useMemo(() => initialTrack?.id === track.id && initialSetup ? initialSetup : readSandbox(track), [track, initialTrack, initialSetup]);
  useEffect(() => {
    if (!ticket) return;
    let cancelled = false;
    const connection = new HubConnectionBuilder().withUrl("/api/rooms/live")
      .withAutomaticReconnect([0, 1000, 3000, 10000]).configureLogging(LogLevel.None).build();
    hub.current = connection;
    const accept = (view: Room) => {
      if (!cancelled) setRoom(old => !old || view.revision >= old.revision ? view : old);
    };
    connection.on("Room", accept);
    connection.on("MembershipEnded", () => {
      if (!cancelled) { forget(); setError("This guest session was removed or left from another tab. Join again if invited."); }
    });
    async function enter() {
      const view = await connection.invoke<Room>("Enter", ticket!.code, ticket!.token);
      accept(view);
      if (!cancelled) { setStatus("Connected"); setError(""); }
    }
    connection.onreconnecting(() => { if (!cancelled) setStatus("Reconnecting — controls locked"); });
    connection.onreconnected(() => { void enter().catch(fail); });
    connection.onclose(() => { if (!cancelled) setStatus("Disconnected"); });
    function fail(e: unknown) {
      if (!cancelled) { setStatus("Disconnected"); setError(e instanceof Error ? e.message : "Could not connect to the room."); }
    }
    setStatus("Connecting");
    void connection.start().then(enter).catch(fail);
    return () => { cancelled = true; hub.current = null; void connection.stop(); };
  }, [ticket, attempt]);
  async function join(create: boolean) {
    setBusy(true); setError("");
    try {
      const next = await request<Ticket>(create ? "/api/rooms" : `/api/rooms/${encodeURIComponent(code.trim().toUpperCase())}/join`, {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify(create ? {name, track, setup} : {name}),
      });
      try {
        sessionStorage.setItem(key(next.code), JSON.stringify(next));
        sessionStorage.setItem("pitwall.room.last", next.code);
      } catch { setStorageNote("This tab cannot save its guest session. Keep it open; after reloading, ask the host to release your old seat."); }
      const url = new URL(location.href); url.searchParams.set("room", next.code);
      history.replaceState(null, "", url); setCode(next.code); setTicket(next); setRoom(null);
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function decide(action: string, driverId?: string, playerId?: string, speed?: number) {
    if (hub.current?.state !== HubConnectionState.Connected || status !== "Connected") return;
    setBusy(true); setError("");
    try {
      const view = await hub.current.invoke<Room>("Decide", {action, driverId, playerId, speed});
      setRoom(old => !old || view.revision >= old.revision ? view : old);
      if (action === "leave") forget();
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function forget() {
    if (ticket) try { sessionStorage.removeItem(key(ticket.code)); sessionStorage.removeItem("pitwall.room.last"); } catch { /* Keep the in-memory UI usable. */ }
    setTicket(null); setRoom(null); setStatus("Disconnected");
    const url = new URL(location.href); url.searchParams.delete("room"); history.replaceState(null, "", url);
  }
  const me = room?.players.find(p => p.id === ticket?.playerId);
  const owner = room?.seats.find(s => s.playerId === ticket?.playerId)?.driverId;
  const state = room?.states.find(s => s.id === owner);
  const isHost = room?.hostId === ticket?.playerId;
  const locked = busy || status !== "Connected" || !me;
  const geometry = useMemo(() => room ? sandboxGeometry(room.track, room.setup) : null, [room?.track, room?.setup]);
  const nextEntry = state && room ? nextPitEntry(state, room.setup) : null;
  const invite = new URL(location.href); invite.search = "";
  if (ticket) invite.searchParams.set("room", ticket.code);
  return <Dialog title="Multiplayer rooms" wide onClose={onClose}>
    <div className="strategy-banner"><span>PRIVATE SHARED RACE</span><p>One server-owned fictional race. Up to six driver seats and twelve guests including spectators. Guest sessions and rooms are temporary; server restarts end them.</p></div>
    {!ticket ? <>
      <label className="lab-field">Guest name<input aria-label="Guest name" maxLength={24} value={name} onChange={e => setName(e.target.value)} /></label>
      <div className="room-entry-grid">
        <section><h3>Host a race</h3><p>{track.name} · {setup.raceLaps} laps · {setup.drivers.length} drivers</p>
          {tracks.length > 0 && <label className="lab-field">Saved circuit<select aria-label="Room saved circuit" value={track.id} onChange={e => {const t = tracks.find(t => t.id === e.target.value); if(t) setTrack(t);}}>
            {!tracks.some(t => t.id === track.id) && <option value={track.id}>{track.name}</option>}
            {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
          <button className="save-button" disabled={busy || !name.trim()} onClick={() => void join(true)}>Create private room</button>
          <p className="lab-note">To host your current custom setup, open Multiplayer from inside the circuit sandbox. Unclaimed drivers continue with their configured pace and stops.</p>
        </section>
        <section><h3>Join friends</h3><label className="lab-field">Room code<input aria-label="Room code" maxLength={12} value={code} onChange={e => setCode(e.target.value.toUpperCase())} /></label>
          <button className="save-button" disabled={busy || !name.trim() || !/^[A-F0-9]{12}$/.test(code)} onClick={() => void join(false)}>Join room</button>
        </section>
      </div>
    </> : <>
      <div className="room-status"><strong>Room <span data-testid="room-code">{ticket.code}</span></strong><span role="status">{status}</span></div>
      <label className="lab-field">Invite friends<input aria-label="Room invite link" readOnly value={invite.href} onFocus={e => e.target.select()} /></label>
      <p className="lab-note">Copy the invitation to another browser/device. A localhost link works only on this computer. Closing this panel disconnects you but reserves your seat; reopening or refreshing this tab reconnects. The race continues on the server.</p>
      {status === "Disconnected" && <div className="lab-actions"><button className="lab-button" onClick={() => setAttempt(n => n+1)}>Reconnect room</button><button className="lab-button" onClick={forget}>Forget guest session</button></div>}
      {room && <>
        <div className="room-status"><h3>{room.complete ? "Final results" : room.running ? "Race running" : room.elapsed ? "Race paused" : "Lobby"}</h3><strong data-testid="room-clock">{formatClock(room.elapsed)}</strong><span>{room.setup.raceLaps} laps · {room.speed}×</span></div>
        <div className="room-entry-grid">
          <section><h3>Guests</h3><ul>{room.players.map(p => <li key={p.id}>{p.name}{p.id === ticket.playerId ? " (you)" : ""}{p.id === room.hostId ? " · host" : ""} · {p.connected ? "online" : "offline, seat reserved"}{p.ready ? " · ready" : ""}{isHost && p.id!==ticket.playerId && <button className="lab-button" disabled={locked} onClick={() => void decide("remove",undefined,p.id)}>Remove {p.name}</button>}</li>)}</ul></section>
          <section><h3>Driver seats</h3>{room.setup.drivers.map(d => {
            const seat = room.seats.find(s => s.driverId === d.id)!;
            const player = room.players.find(p => p.id === seat.playerId);
            return <div key={d.id} className="room-seat"><span>{d.name} · {player?.name ?? "Unclaimed"}</span>
              {!player && <button className="lab-button" disabled={locked} onClick={() => void decide("claim", d.id)}>Claim {d.name}</button>}
              {player && (player.id === ticket.playerId || isHost) && <button className="lab-button" disabled={locked} onClick={() => void decide("release",d.id)}>Release {d.name}</button>}
              {player && (player.id === ticket.playerId || isHost) && <button className="lab-button" disabled={locked || !recipient} onClick={() => void decide("handover",d.id,recipient)}>Hand over {d.name}</button>}
            </div>;
          })}</section>
        </div>
        <div className="lab-actions">
          <button className="lab-button" disabled={locked || !owner || room.elapsed > 0} onClick={() => void decide("ready")}>{me?.ready ? "Not ready" : "Ready to race"}</button>
          {isHost && <><button className="save-button" disabled={locked || room.running || room.complete} onClick={() => void decide("start")}>{room.elapsed ? "Resume shared race" : "Start shared race"}</button>
            <button className="lab-button" disabled={locked || !room.running} onClick={() => void decide("pause")}>Pause shared race</button>
            <button className="lab-button" disabled={locked} onClick={() => void decide("reset")}>Reset shared race</button>
            <label className="lab-field">Shared speed<select aria-label="Shared race speed" disabled={locked} value={room.speed} onChange={e => void decide("speed",undefined,undefined,Number(e.target.value))}>{[1,5,10,25].map(n => <option key={n} value={n}>{n}×</option>)}</select></label></>}
        </div>
        <div className="sandbox-stage">
          <svg className="studio-canvas" viewBox="0 0 800 520" role="img" aria-label="Shared race circuit">
            <path d={geometry!.path} fill="none" stroke="#52bda5" strokeWidth="5" />
            <polyline points={geometry!.pit.points.map(p => p.join(",")).join(" ")} fill="none" stroke="#f5b257" strokeWidth="3" strokeDasharray="5 4" />
            {room.states.map(s => {const point = previewPoint(s, geometry!);const d=room.setup.drivers.find(d=>d.id===s.id)!;return <g key={s.id} transform={`translate(${point})`}><circle r="8" fill={d.color}/><text x="12" y="-10" fill="currentColor" fontSize="13">{d.name}</text></g>;})}
            <circle cx={pointOnRoute(geometry!.main,0)[0]} cy={pointOnRoute(geometry!.main,0)[1]} r="4" fill="currentColor" />
          </svg>
          <div className="sandbox-order" aria-label="Shared running order">{room.order.map((id,i) => {const s=room.states.find(s=>s.id===id)!;const d=room.setup.drivers.find(d=>d.id===id)!;return <div className="sandbox-order-row" key={id}><b>{i+1}</b><span>{d.name}<small>{s.finishTime !== null ? `${s.finishTime.toFixed(3)}s · FINISHED` : `LAP ${Math.max(1,Math.floor(s.raceProgress)+1)} · ${s.phase.toUpperCase()}`}</small></span><small>{s.stops} stops</small></div>;})}</div>
        </div>
        <section className="sandbox-drivers" aria-label="Your shared pit strategy"><h3>Your strategy · {owner ? room.setup.drivers.find(d=>d.id===owner)?.name : "Spectating"}</h3>
          <p data-testid="room-pit-status">{!state ? "Claim an available driver to make decisions." : state.phase !== "track" ? `Driver is ${state.phase}; pit calls are locked.` : state.pitTarget !== null ? `Pit queued on lap ${Math.floor(state.pitTarget!) + 1}.` : "Stay out. No pit call queued."}</p>
          <div className="lab-actions"><button className="save-button" disabled={locked || nextEntry === null} onClick={() => void decide("box",owner)}>{state && nextEntry !== null && Math.floor(nextEntry)>Math.floor(Math.max(0,state.raceProgress)) ? "Box next lap" : "Box this lap"}</button>
            <button className="lab-button" disabled={locked || state?.phase !== "track" || state.pitTarget === null} onClick={() => void decide("cancel",owner)}>Cancel shared pit call</button></div>
        </section>
        <div className="lab-actions"><label className="lab-field">Handover recipient<select aria-label="Handover recipient" value={recipient} disabled={locked} onChange={e => setRecipient(e.target.value)}><option value="">Choose connected guest</option>{room.players.filter(p=>p.connected&&p.id!==ticket.playerId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          {isHost && <button className="lab-button" disabled={locked || !recipient} onClick={() => void decide("host",undefined,recipient)}>Transfer host role</button>}
          <button className="lab-button" disabled={locked} onClick={() => void decide("leave")}>Leave room and release seat</button>
        </div>
        {!me && <><p role="alert">This guest session has left the room. Close other tabs using it, then forget this session and join again.</p><button className="lab-button" onClick={forget}>Forget guest session</button></>}
      </>}
    </>}
    {storageNote && <p role="status">{storageNote}</p>}
    {error && <p role="alert">{error}</p>}
    <p className="lab-note">Guest tokens stay in this tab, outside invite links. Rooms run in one API process and expire after two hours without connected guests or decisions. This private-room prototype has no accounts, permanent room storage or multi-server coordination.</p>
  </Dialog>;
}
