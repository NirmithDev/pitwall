import {useEffect,useMemo,useRef,useState} from "react";
import Dialog from "./Dialog";
import NumberField from "./NumberField";
import {request} from "./api";
import {newTrack,readTracks,downloadJson,type CustomTrack} from "./custom-track";
import {circuitFromReplay} from "./replay-circuit";
import {readTeam} from "./recruitment";
import {formatClock,type Race} from "./race";
import type {Catalog} from "./RaceLibrary";
import {nextPitEntry,pendingPit,previewPoint,raceOrder,sandboxGeometry} from "./sandbox";
import {advanceChampionship,beginRound,championshipCall,championshipKey,championshipPoints,createChampionship,discardUnreadableChampionship,readChampionship,saveChampionship,standings,type Championship} from "./championship";

export default function LocalChampionship({race,onClose}:{race:Race;onClose:()=>void}) {
  const [loaded]=useState(readChampionship);
  const [recoveryRaw,setRecoveryRaw]=useState(loaded.error?loaded.raw:null);
  const [champ,setChamp]=useState(loaded.championship);
  const current=useRef(champ);
  const saved=useRef(champ?{id:champ.id,revision:champ.revision}:null);
  const saving=useRef(false),runningRef=useRef(false),unsaved=useRef(false);
  const saveWaiters=useRef<(()=>void)[]>([]);
  const [busy,setBusy]=useState(false),[running,setRunning]=useState(false),[dirty,setDirty]=useState(false);
  const [error,setError]=useState(loaded.error),[writeError,setWriteError]=useState("");
  const [conflict,setConflict]=useState(false),[message,setMessage]=useState(champ?"Saved championship loaded. Any saved race resumes paused.":"");
  const [creating,setCreating]=useState(!champ),[confirmReplace,setConfirmReplace]=useState(false),[confirmDiscard,setConfirmDiscard]=useState(false);
  const [name,setName]=useState("Midnight Cup"),[laps,setLaps]=useState(3),[base,setBase]=useState(60),[speed,setSpeed]=useState(10);
  const [selected,setSelected]=useState<[string,string,string]>(["", "", ""]);
  const [catalog,setCatalog]=useState<Catalog|null>(null),[catalogError,setCatalogError]=useState("");
  const [starter]=useState(newTrack),[customs]=useState(readTracks);
  const [controlled,setControlled]=useState(champ?.ownDriverIds[0]??"");
  const options=useMemo(()=>{
    const list=[{id:"starter",label:"Midnight circuit",track:starter as CustomTrack|null,raceId:null as string|null},
      ...customs.map(t=>({id:`custom:${t.id}`,label:t.name,track:t as CustomTrack|null,raceId:null as string|null})),
      {id:`replay:${race.id}`,label:`${race.circuit} ${race.year}`,track:null as CustomTrack|null,raceId:race.id},
      ...(catalog?.sessions.filter(s=>s.cached&&s.id!==race.id).map(s=>({id:`replay:${s.id}`,label:`${s.circuit} ${s.year}`,track:null as CustomTrack|null,raceId:s.id}))??[])];
    return list;
  },[starter,customs,race,catalog]);
  useEffect(()=>{
    const controller=new AbortController();
    void request<Catalog>("/api/sessions",{signal:controller.signal}).then(setCatalog).catch(e=>{if(!controller.signal.aborted)setCatalogError(e.message);});
    return ()=>controller.abort();
  },[]);
  useEffect(()=>{setSelected(old=>{
    const next=[...old] as [string,string,string];
    for(let i=0;i<3;i++)if(!next[i])next[i]=options.find(v=>!next.includes(v.id))?.id??"";
    return next;
  });},[options]);
  const round=champ?.session?.round;
  const venue=round!==undefined?champ?.venues[round]:null;
  const geometry=useMemo(()=>venue?sandboxGeometry(venue.track,venue.setup):null,[venue]);
  function replace(next:Championship|null) {current.current=next;setChamp(next);unsaved.current=true;setDirty(true);}
  function stop() {runningRef.current=false;setRunning(false);}
  async function persist():Promise<boolean> {
    const snapshot=current.current;
    if(!snapshot)return true;
    if(saving.current)return false;
    saving.current=true;setBusy(true);
    try {
      const next=await saveChampionship(saved.current,snapshot);
      saved.current={id:next.id,revision:next.revision};
      const unchanged=current.current===snapshot;
      if(current.current?.id===snapshot.id){current.current={...current.current,revision:next.revision};setChamp(current.current);}
      unsaved.current=!unchanged;setDirty(!unchanged);setWriteError("");setMessage(`Saved ${next.results.length}/3 results${next.session?` and checkpoint ${formatClock(next.session.elapsed)}`:""}.`);
      return true;
    }catch(e){stop();setWriteError((e as Error).message);return false;}
    finally{saving.current=false;setBusy(false);saveWaiters.current.splice(0).forEach(resolve=>resolve());}
  }
  useEffect(()=>{
    const timer=setInterval(()=>{if(current.current&&unsaved.current&&!conflict&&!creating)void persist();},2000);
    return ()=>clearInterval(timer);
  },[conflict,creating]);
  useEffect(()=>{
    const external=(e:StorageEvent)=>{if(e.key===championshipKey||e.key===null){stop();setConflict(true);setWriteError("Championship changed in another tab. Export unsaved progress if needed, then load the saved championship.");}};
    window.addEventListener("storage",external);return ()=>window.removeEventListener("storage",external);
  },[]);
  useEffect(()=>{
    if(!running||!geometry)return;
    let frame=0,previous=performance.now();
    const tick=(now:number)=>{
      if(!runningRef.current||!current.current?.session)return;
      const seconds=Math.min((now-previous)/1000,.1)*speed;previous=now;
      const next=advanceChampionship(current.current,seconds,geometry);replace(next);
      if(!next.session){stop();void persist();return;}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(frame);
  },[running,speed,geometry]);
  function loadSaved() {
    stop();const next=readChampionship();current.current=next.championship;setChamp(next.championship);
    saved.current=next.championship?{id:next.championship.id,revision:next.championship.revision}:null;
    unsaved.current=false;setRecoveryRaw(next.error?next.raw:null);setError(next.error);setWriteError("");setConflict(false);setDirty(false);setCreating(!next.championship);setControlled(next.championship?.ownDriverIds[0]??"");setMessage("Saved championship loaded; race is paused.");
  }
  async function create() {
    setBusy(true);setError("");
    try {
      const team=readTeam();if(team.warning)throw new Error(team.warning);
      const choices=await Promise.all(selected.map(async id=>{
        const choice=options.find(v=>v.id===id);if(!choice)throw new Error("Choose all three venues.");
        const replay=choice.raceId?(choice.raceId===race.id?race:await request<Race>(`/api/sessions/${encodeURIComponent(choice.raceId)}`)):null;
        return {id:choice.id,label:choice.label,track:choice.track??circuitFromReplay(replay!.track,`${choice.label} · cup`)};
      }));
      const next=createChampionship(name,team.team,choices,laps,base);
      const stored=await saveChampionship(saved.current,next);
      current.current=stored;setChamp(stored);saved.current={id:stored.id,revision:stored.revision};unsaved.current=false;setDirty(false);setWriteError("");setConflict(false);setCreating(false);setConfirmReplace(false);setControlled(stored.ownDriverIds[0]);setMessage("Championship saved. Your signed lineup and calendar are frozen for these three rounds.");
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function close() {
    stop();
    if(saving.current)await new Promise<void>(resolve=>saveWaiters.current.push(resolve));
    if(!current.current||await persist())onClose();
  }
  const control=champ?.session?.states.find(s=>s.id===controlled);
  const driver=champ?.entrants.find(d=>d.id===controlled);
  const target=control&&venue?pendingPit(control,driver!,venue.setup):null;
  const nextEntry=control&&venue?nextPitEntry(control,venue.setup):null;
  const rows=champ?standings(champ):[];
  const locked=busy||conflict||!!writeError;
  const last=champ?.results.at(-1);
  return <Dialog title="Local championship" wide onClose={()=>void close()}>
    <div className="strategy-banner"><span>THREE-ROUND FICTIONAL CUP</span><p>Race your two signed drivers against four rivals. Earn championship points across three venues. Results and race checkpoints save in this browser; recruiting credits and multiplayer rooms stay separate.</p></div>
    {error&&<p role="alert">{error}</p>}{writeError&&<p role="alert">Save failed: {writeError}</p>}
    <div className="lab-actions"><button className="lab-button" disabled={busy} onClick={loadSaved}>Load saved championship</button>
      {champ&&<button className="lab-button" onClick={()=>downloadJson("pitwall-championship.json",champ)}>Export championship JSON</button>}
      {recoveryRaw!==null&&<><button className="lab-button" onClick={()=>downloadJson("pitwall-championship-backup.json",{raw:recoveryRaw})}>Back up unreadable championship</button><button className="lab-button" onClick={()=>setConfirmDiscard(true)}>Discard unreadable championship</button></>}
      {writeError&&<button className="lab-button" onClick={onClose}>Close without saving</button>}
    </div>
    {confirmDiscard&&<div className="studio-validation"><p>This deletes only the unreadable championship record. Download its backup first.</p><button className="lab-button" onClick={async()=>{try{await discardUnreadableChampionship(recoveryRaw!);setConfirmDiscard(false);loadSaved();}catch(e){setError((e as Error).message);}}}>Confirm discard championship</button></div>}
    {creating?<section aria-label="Championship setup"><h3>Enter your selected signed lineup</h3><p className="lab-note">Select both race seats in Driver recruitment first. Entry is free; this first cup has points but no prize credits or training. Cached replay venues and saved custom circuits are available; import other replays through Browse races first.</p>
      <div className="sandbox-controls"><label className="lab-field">Championship name<input aria-label="Championship name" maxLength={48} value={name} onChange={e=>setName(e.target.value)}/></label>
        <label className="lab-field">Laps per round<NumberField label="Championship laps" min={1} max={50} value={laps} onChange={setLaps}/></label>
        <label className="lab-field">Base lap seconds<NumberField label="Championship base lap seconds" min={30} max={300} value={base} onChange={setBase}/></label>
        {selected.map((id,i)=><label key={i} className="lab-field">Round {i+1} venue<select aria-label={`Round ${i+1} venue`} value={id} onChange={e=>setSelected(old=>old.map((v,n)=>n===i?e.target.value:v) as [string,string,string])}><option value="">Choose venue</option>{options.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>)}
      </div>
      {catalogError&&<p className="lab-note">Cached venue list unavailable: {catalogError}. Current/saved circuits can still be selected.</p>}
      <div className="lab-actions"><button className="save-button" disabled={busy||selected.some(id=>!id)||new Set(selected).size!==3||!name.trim()} onClick={()=>void create()}>{champ?"Replace saved championship":"Create three-race championship"}</button>{champ&&<button className="lab-button" onClick={()=>setCreating(false)}>Keep current championship</button>}</div>
      {champ&&<p className="lab-note">Creating this replaces the saved championship, including its results and any checkpoint. Export the old championship first if needed.</p>}
    </section>:champ&&<>
      <div className="room-status"><h3>{champ.name}</h3><strong>{champ.teamName}</strong><span data-testid="cup-progress">{champ.results.length}/3 rounds complete</span><span>{dirty?"Unsaved progress": "Saved"}</span></div>
      <ol>{champ.venues.map((v,i)=><li key={v.id}>{v.label} · {i<champ.results.length?"Completed":i===champ.results.length?"Next/current":"Upcoming"}</li>)}</ol>
      <div className="lab-actions"><button className="lab-button" disabled={busy||conflict} onClick={()=>{stop();void persist();}}>Save championship checkpoint</button>
        {!champ.session&&champ.results.length<3&&<button className="save-button" disabled={locked} onClick={()=>{replace(beginRound(champ));void persist();}}>Begin round {champ.results.length+1}</button>}
        <button className="lab-button" disabled={busy} onClick={()=>{stop();setConfirmReplace(true);}}>Create another championship</button>
      </div>
      {confirmReplace&&<section className="studio-validation"><p>A new championship replaces this saved cup after you confirm its calendar. Existing recruiting data stays intact.</p><button className="lab-button" onClick={()=>{setCreating(true);setConfirmReplace(false);}}>Choose new championship calendar</button><button className="lab-button" onClick={()=>setConfirmReplace(false)}>Keep this cup</button></section>}
      {champ.session&&venue&&geometry&&<section aria-label="Championship race"><div className="room-status"><h3>Round {champ.session.round+1} · {venue.label}</h3><strong data-testid="cup-clock">{formatClock(champ.session.elapsed)}</strong></div>
        <div className="sandbox-stage"><svg className="studio-canvas" viewBox="0 0 800 520" role="img" aria-label="Championship circuit"><path d={geometry.path} fill="none" stroke="#52bda5" strokeWidth="4"/><polyline points={geometry.pit.points.map(p=>p.join(",")).join(" ")} fill="none" stroke="#f5b257" strokeWidth="3"/>{champ.session.states.map(s=>{const p=previewPoint(s,geometry),d=champ.entrants.find(d=>d.id===s.id)!;return <g key={s.id} transform={`translate(${p})`}><circle r="8" fill={d.color}/><text x="11" y="-10" fontSize="12" fill="currentColor">{d.name}</text></g>;})}</svg>
          <div className="sandbox-order">{raceOrder(champ.session.states,venue.setup).map((s,i)=><div className="sandbox-order-row" key={s.id}><b>{i+1}</b><span>{champ.entrants.find(d=>d.id===s.id)!.name}<small>{s.phase.toUpperCase()} · {s.stops} stops</small></span></div>)}</div></div>
        <div className="lab-actions"><button className="save-button" disabled={locked} onClick={()=>{if(running){stop();void persist();}else{runningRef.current=true;setRunning(true);}}}>{running?"Pause championship race":"Run championship race"}</button>
          <button className="lab-button" disabled={locked} onClick={()=>{stop();replace(advanceChampionship(current.current!,venue.setup.baseLapSeconds,geometry));void persist();}}>Advance championship lap</button>
          <label className="lab-field">Race speed<select aria-label="Championship speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[1,5,10,25].map(n=><option key={n} value={n}>{n}×</option>)}</select></label>
          <label className="lab-field">Your driver<select aria-label="Championship controlled driver" value={controlled} onChange={e=>setControlled(e.target.value)}>{champ.entrants.filter(d=>champ.ownDriverIds.includes(d.id)).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <button className="lab-button" disabled={locked||nextEntry===null} onClick={()=>{try{replace(championshipCall(current.current!,controlled,true));}catch(e){setError((e as Error).message);}}}>{control&&nextEntry!==null&&Math.floor(nextEntry)>Math.floor(Math.max(0,control.raceProgress))?"Box championship next lap":"Box championship this lap"}</button>
          <button className="lab-button" disabled={locked||control?.phase!=="track"||target===null} onClick={()=>{replace(championshipCall(current.current!,controlled,false));}}>Cancel championship pit call</button>
        </div><p className="lab-note">{target!==null?`Your driver's pit entry is queued on lap ${Math.floor(target)+1}.`:control?.phase==="track"?"Your driver stays out until a pit call.":`Your driver is ${control?.phase}.`}</p>
      </section>}
      {!champ.session&&last&&<section aria-label="Last championship result"><h3>{champ.results.length===3?"Championship complete":"Round complete"} · {champ.venues[last.round].label}</h3><ol>{last.classification.map((r,i)=><li key={r.driverId}>{champ.entrants.find(d=>d.id===r.driverId)!.name} · {r.finishTime.toFixed(3)}s · +{championshipPoints[i]} points</li>)}</ol></section>}
      <section aria-label="Championship standings"><h3>Driver standings</h3><div className="sandbox-order">{rows.map((r,i)=><div className="sandbox-order-row" key={r.driver.id}><b>{i+1}</b><span>{r.driver.name}{champ.ownDriverIds.includes(r.driver.id)?" · your team":""}<small>{r.finishes[0]} wins</small></span><strong>{r.points} pts</strong></div>)}</div><p>Team points: <strong data-testid="cup-team-points">{rows.filter(r=>champ.ownDriverIds.includes(r.driver.id)).reduce((sum,r)=>sum+r.points,0)}</strong></p></section>
      <p className="lab-note">Scoring: 25/18/15/12/10/8. Ties use wins, then seconds, thirds and later places, then original grid order. Signed builds and rivals are frozen for this cup; later recruiting changes apply to the next championship.</p>
    </>}
    <p role="status">{busy?"Saving/loading…":message}</p><p className="lab-note">Checkpoints save about every two seconds, on pauses/round finishes and on normal panel close. A hard refresh/crash can lose the last unsaved seconds. Saved races reopen paused. Storage is browser-origin local, and only one active editing tab is supported. Export is an inspection record; no championship importer is implemented.</p>
  </Dialog>;
}
