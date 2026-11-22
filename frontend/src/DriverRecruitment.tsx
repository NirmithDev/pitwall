import { useEffect, useState } from "react";
import Dialog from "./Dialog";
import NumberField from "./NumberField";
import { downloadJson } from "./custom-track";
import type { SandboxSetup } from "./sandbox";
import {
  applyLineup, assignSeat, createDriver, customPoints, driverEffects, ensureTeam, overall, pointsUsed,
  readTeam, refreshFee, refreshMarket, releaseDriver, releaseRefund, resetTeam, saveTeam,
  signDriver, signingFee, teamKey, type DriverStats, type RecruitDriver, type Team,
} from "./recruitment";

const stats: {key: keyof DriverStats; label: string}[] = [
  {key:"pace",label:"Pace"}, {key:"consistency",label:"Consistency"}, {key:"pitDiscipline",label:"Pit discipline"},
];
function Stats({driver}: {driver: RecruitDriver}) {
  const effects = driverEffects(driver.stats);
  return <>
    <div className="recruit-stats">{stats.map(s => <div key={s.key}><span>{s.label}</span><strong>{driver.stats[s.key]}</strong><meter min={10} max={100} value={driver.stats[s.key]} aria-label={`${driver.name} ${s.label}`} /></div>)}</div>
    <p className="lab-note">Pace offset {effects.paceOffset > 0 ? "+" : ""}{effects.paceOffset.toFixed(2)}s/lap · service {effects.serviceSeconds.toFixed(2)}s</p>
  </>;
}
export default function DriverRecruitment({onClose, setup, onApply}: {
  onClose: () => void; setup?: SandboxSetup; onApply?: (setup: SandboxSetup) => void;
}) {
  const [loaded] = useState(readTeam);
  const [team, setTeam] = useState(loaded.team);
  const [warning, setWarning] = useState(loaded.warning);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(loaded.team.revision === 0 && !loaded.warning);
  const [confirmReset, setConfirmReset] = useState(false);
  const [draft, setDraft] = useState<RecruitDriver>(() => ({id:crypto.randomUUID(),name:"My rookie",color:"#64d2b6",origin:"custom",stats:{pace:70,consistency:70,pitDiscipline:70}}));
  useEffect(() => {
    let active = true;
    if (loaded.team.revision === 0 && !loaded.warning) {
      void ensureTeam(loaded.team).then(saved => { if(active) setTeam(saved); })
        .catch(e => { if(active) setWarning((e as Error).message); })
        .finally(() => { if(active) setBusy(false); });
    }
    return () => { active = false; };
  }, [loaded]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === teamKey || event.key === null) setWarning("Team data changed in another tab. Load latest team before editing.");
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  async function transact(change: (team: Team) => Team, success: string) {
    setBusy(true); setMessage("");
    try {
      const saved = await saveTeam(team, change(team));
      setTeam(saved); setWarning(""); setMessage(success);
      return true;
    } catch(e) { setWarning((e as Error).message); return false; }
    finally { setBusy(false); }
  }
  function loadLatest() {
    const result = readTeam();setTeam(result.team);setWarning(result.warning);setMessage("Latest team loaded. The custom draft and current race are unchanged.");
  }
  async function startFresh() {
    setBusy(true);
    try {setTeam(await resetTeam());setWarning("");setMessage("Fresh team started with 12,000 credits.");setConfirmReset(false);}
    catch(e) {setWarning((e as Error).message);}finally{setBusy(false);}
  }
  const fee = signingFee(draft.stats), used = pointsUsed(draft.stats);
  const ready = team.lineup.every(id => id !== null);
  return <Dialog title="Driver recruitment" wide onClose={onClose}>
    <div className="strategy-banner"><span>FICTIONAL TEAM MANAGER</span><p>Recruit generated drivers or build your own. Credits and ratings are local game values. Your roster is saved in this browser; it is separate from multiplayer guest ownership.</p></div>
    <div className="room-status"><h3>{team.name}</h3><strong data-testid="team-credits">{team.credits.toLocaleString("en-US")} credits</strong><span data-testid="roster-count">{team.roster.length}/6 drivers</span></div>
    {warning && <p role="alert">{warning}</p>}
    <div className="lab-actions">
      {warning && <button className="lab-button" onClick={() => {
        try {downloadJson("pitwall-team-stored-backup.json",{raw:localStorage.getItem(teamKey)});}catch(e){setWarning((e as Error).message);}
      }}>Back up stored team data</button>}
      <button className="lab-button" disabled={busy} onClick={loadLatest}>Load latest team</button>
      <button className="lab-button" disabled={busy} onClick={() => downloadJson("pitwall-team.json",team)}>Export team JSON</button>
      <button className="lab-button" disabled={busy} onClick={() => setConfirmReset(true)}>Start fresh team</button>
    </div>
    {confirmReset && <section className="studio-validation" aria-label="Confirm team reset"><p>This replaces the saved roster, market, lineup and credits with a fresh team. Existing races and saved circuits keep their copied drivers. Export your team first if you want a record.</p><div className="lab-actions"><button className="save-button" disabled={busy} onClick={() => void startFresh()}>Confirm fresh team</button><button className="lab-button" onClick={() => setConfirmReset(false)}>Keep current team</button></div></section>}
    <section aria-label="Team lineup" className="sandbox-drivers"><h3>Race lineup</h3>
      <div className="lab-actions">{([0,1] as const).map(i => <label key={i} className="lab-field">Race seat {i+1}
        <select aria-label={`Race seat ${i+1}`} disabled={busy} value={team.lineup[i] ?? ""} onChange={e => void transact(t => assignSeat(t,i,e.target.value || null), "Lineup saved.")}>
          <option value="">Choose signed driver</option>{team.roster.map(d => <option key={d.id} value={d.id}>{d.name} · {overall(d.stats)} OVR</option>)}
        </select></label>)}
        <button className="lab-button" disabled={busy || !ready} onClick={() => void transact(t => ({...t,lineup:[t.lineup[1],t.lineup[0]]}), "Race seats swapped and saved.")}>Swap race seats</button>
        {setup && onApply && <button className="save-button" disabled={busy || !ready || !!warning} onClick={() => {
          try {onApply(applyLineup(team,setup));onClose();}catch(e){setWarning((e as Error).message);}
        }}>Apply lineup and restart sandbox</button>}
      </div>
      <p className="lab-note">Assign two different signed drivers. Selecting the other seat's driver swaps them. Applying replaces grid slots 1–2, keeps their scheduled pit laps and other opponents, and restarts the local run. Save the circuit/race setup afterward to retain that grid. Existing multiplayer rooms do not change.</p>
      {!onApply && <p className="lab-note">To race this lineup, open Custom circuit studio → Circuit race sandbox → Recruit and manage drivers.</p>}
    </section>
    <section className="sandbox-drivers" aria-label="Signed roster"><h3>Your roster</h3>
      {!team.roster.length && <p>No signed drivers yet. Scout the market or create a custom rookie below.</p>}
      <div className="recruit-grid">{team.roster.map(d => <article className="recruit-card" key={d.id} aria-label={`Signed ${d.name}`}>
        <div className="room-status"><h4 style={{borderColor:d.color}}>{d.name}</h4><strong>{overall(d.stats)} OVR</strong></div>
        <span className="lab-note">{d.origin === "custom" ? "CUSTOM BUILD" : "RECRUITED"}{team.lineup.includes(d.id) ? " · RACE LINEUP" : " · RESERVE"}</span><Stats driver={d}/>
        <button className="lab-button" disabled={busy} onClick={() => void transact(t => releaseDriver(t,d.id), `${d.name} released. Lineup selection cleared where needed.`)}>Release {d.name} · +{releaseRefund(d).toLocaleString("en-US")}</button>
      </article>)}</div>
    </section>
    <section className="sandbox-drivers" aria-label="Driver market"><div className="room-status"><h3>Scout market</h3><button className="lab-button" disabled={busy || team.credits < refreshFee} onClick={() => void transact(refreshMarket, "New market saved. Signed drivers and lineup retained.")}>Scout new market · {refreshFee} credits</button></div>
      <p className="lab-note">Signing is disabled when you cannot afford the fee or your six-driver roster is full. Released drivers leave the roster and are not returned to this market.</p>
      <div className="recruit-grid">{team.market.map(d => <article key={d.id} className="recruit-card" aria-label={`Market ${d.name}`}>
        <div className="room-status"><h4 style={{borderColor:d.color}}>{d.name}</h4><strong>{overall(d.stats)} OVR</strong></div><Stats driver={d}/>
        <button className="save-button" disabled={busy || team.roster.length >= 6 || team.credits < signingFee(d.stats)} onClick={() => void transact(t => signDriver(t,d.id), `${d.name} signed and saved to your roster.`)}>Sign {d.name} · {signingFee(d.stats).toLocaleString("en-US")} credits</button>
      </article>)}</div>
      {!team.market.length && <p>All prospects from this market have been signed. Scout another market for 250 credits.</p>}
    </section>
    <section className="sandbox-drivers" aria-label="Custom driver builder"><h3>Build a custom driver</h3>
      <div className="sandbox-controls"><label className="lab-field">Driver name<input aria-label="Custom driver name" maxLength={24} value={draft.name} onChange={e => setDraft({...draft,name:e.target.value})}/></label>
        <label className="lab-field">Colour<input type="color" aria-label="Custom driver colour" value={draft.color} onChange={e => setDraft({...draft,color:e.target.value})}/></label>
        {stats.map(s => <label key={s.key} className="lab-field">{s.label}<NumberField label={`Custom ${s.label.toLowerCase()}`} min={10} max={100} value={draft.stats[s.key]} onChange={n => setDraft({...draft,stats:{...draft.stats,[s.key]:n}})}/></label>)}
      </div>
      <p data-testid="custom-points">{used}/{customPoints} stat points · signing fee {fee.toLocaleString("en-US")} credits</p>
      {used > customPoints && <p role="alert">Reduce stats to 210 points or fewer before signing.</p>}
      <Stats driver={draft}/>
      <button className="save-button" disabled={busy || used > customPoints || !draft.name.trim() || team.credits < fee || team.roster.length >= 6} onClick={async () => {
        if (await transact(t => createDriver(t,draft), `${draft.name.trim()} created, signed and saved.`)) setDraft({...draft,id:crypto.randomUUID()});
      }}>Create and sign custom driver</button>
    </section>
    <p role="status">{message}</p>
    <p className="lab-note">Model: pace and consistency form a 60/40 weighted pace rating; offset = (70 − rating) × 0.12 seconds/lap. Pit discipline gives service = 5 − rating × 0.04 seconds. Consistency is a steady pace modifier here, not random lap variation; tyres, traffic and mistakes are not simulated. Signing fees rise with squared stats; releases refund 40%. Export is an inspection record; a team importer is not implemented.</p>
  </Dialog>;
}
