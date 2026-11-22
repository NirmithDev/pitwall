import {parseTrack, type CustomTrack} from "./custom-track";
import {applyLineup, type Team} from "./recruitment";
import {advanceRace, initialGrid, newSandboxDriver, nextPitEntry, parseSandbox, raceOrder, sandboxDefaults, sandboxGeometry, validateSandbox, type PreviewState, type SandboxDriver, type SandboxSetup} from "./sandbox";

export const championshipKey = "pitwall.championship.v1";
export const championshipPoints = [25,18,15,12,10,8];
export type Venue = {id:string;label:string;track:CustomTrack;setup:SandboxSetup};
export type Classification = {driverId:string;finishTime:number};
export type RoundResult = {round:number;classification:Classification[]};
export type Championship = {
  version:1;id:string;revision:number;name:string;teamName:string;ownDriverIds:string[];
  entrants:SandboxDriver[];venues:Venue[];results:RoundResult[];
  session:{round:number;elapsed:number;states:PreviewState[]}|null;
};
export function createChampionship(name:string,team:Team,choices:{id:string;label:string;track:CustomTrack}[],laps:number,baseLapSeconds:number):Championship {
  if(!name.trim()||name.trim().length>48)throw new Error("Use a championship name of 1–48 characters.");
  if(choices.length!==3||new Set(choices.map(v=>v.id)).size!==3)throw new Error("Choose three different venues.");
  if(!Number.isInteger(laps)||laps<1||laps>50||!Number.isFinite(baseLapSeconds)||baseLapSeconds<30||baseLapSeconds>300)throw new Error("Use 1–50 laps and a 30–300 second base pace.");
  const seedSetup=sandboxDefaults(choices[0].track);
  seedSetup.drivers=Array.from({length:6},(_,i)=>({...newSandboxDriver(i),name:`Rival ${i-1}`,paceOffset:[0,0,-1.5,.5,2,3.5][i],pitLap:i===2?Math.min(2,laps):0}));
  const entrants=applyLineup(team,seedSetup).drivers;
  const venues=choices.map(v=>{
    const track=parseTrack(v.track);
    const setup={...sandboxDefaults(track),raceLaps:laps,baseLapSeconds,drivers:entrants.map(d=>({...d}))};
    const errors=validateSandbox(track,setup);
    if(errors.length)throw new Error(`${v.label}: ${errors.join(" ")}`);
    return {...v,track,setup};
  });
  return {version:1,id:crypto.randomUUID(),revision:0,name:name.trim(),teamName:team.name,ownDriverIds:entrants.slice(0,2).map(d=>d.id),entrants,venues,results:[],session:null};
}
export function beginRound(c:Championship):Championship {
  if(c.session)throw new Error("Finish the active round before starting another.");
  if(c.results.length>=3)throw new Error("This championship is complete.");
  return {...c,session:{round:c.results.length,elapsed:0,states:initialGrid(c.entrants)}};
}
export function advanceChampionship(c:Championship,seconds:number,geometry?:ReturnType<typeof sandboxGeometry>):Championship {
  if(!c.session)return c;
  const venue=c.venues[c.session.round];
  const session={...advanceRace(c.session,venue.setup,geometry??sandboxGeometry(venue.track,venue.setup),seconds),round:c.session.round};
  const next={...c,session};
  return session.states.every(s=>s.phase==="finished")?recordRound(next):next;
}
export function recordRound(c:Championship):Championship {
  if(!c.session||c.session.round!==c.results.length||!c.session.states.every(s=>s.phase==="finished"&&s.finishTime!==null))throw new Error("Only the next fully finished round can be recorded.");
  const classification=raceOrder(c.session.states,c.venues[c.session.round].setup).map(s=>({driverId:s.id,finishTime:s.finishTime!}));
  return {...c,results:[...c.results,{round:c.session.round,classification}],session:null};
}
export function championshipCall(c:Championship,id:string,box:boolean):Championship {
  if(!c.session||!c.ownDriverIds.includes(id))throw new Error("Choose one of your active team drivers.");
  const setup=c.venues[c.session.round].setup;
  const state=c.session.states.find(s=>s.id===id)!;
  if(state.phase!=="track")throw new Error("This driver has committed to the pit lane or finished.");
  const target=box?nextPitEntry(state,setup):null;
  if(box&&target===null)throw new Error("No pit entry remains before the finish.");
  return {...c,session:{...c.session,states:c.session.states.map(s=>s.id===id?{...s,pitTarget:target}:s)}};
}
export function standings(c:Championship) {
  const rows=c.entrants.map((d,index)=>({driver:d,points:0,finishes:Array(6).fill(0) as number[],grid:index}));
  for(const result of c.results)result.classification.forEach((r,i)=>{
    const row=rows.find(row=>row.driver.id===r.driverId)!;row.points+=championshipPoints[i];row.finishes[i]++;
  });
  return rows.sort((a,b)=>b.points-a.points||a.finishes.reduce((tie,n,i)=>tie||b.finishes[i]-n,0)||a.grid-b.grid);
}
const number=(n:unknown,min:number,max:number)=>typeof n==="number"&&Number.isFinite(n)&&n>=min&&n<=max;
function parseSession(raw:NonNullable<Championship["session"]>,c:Championship):NonNullable<Championship["session"]> {
  if(!raw||!Number.isInteger(raw.round)||raw.round<0||raw.round>2||raw.round!==c.results.length||!number(raw.elapsed,0,1e7)||!Array.isArray(raw.states)||raw.states.length!==6)throw new Error("Invalid saved race checkpoint.");
  const laps=c.venues[raw.round].setup.raceLaps;
  const states=raw.states.map((s,i)=>{
    if(!s||s.id!==c.entrants[i].id||!["track","pit","service","finished"].includes(s.phase)||!number(s.raceProgress,-.04,laps+1e-7)||
      !number(s.pitProgress,0,1)||!number(s.stopRemaining,0,15)||typeof s.serviced!=="boolean"||typeof s.visited!=="boolean"||typeof s.finishedInPit!=="boolean"||
      !Number.isInteger(s.stops)||s.stops<0||s.stops>1000||
      (s.pitTarget!==undefined&&s.pitTarget!==null&&!number(s.pitTarget,0,laps))||
      (s.finishTime!==null&&!number(s.finishTime,0,raw.elapsed+1e-7))||
      (s.phase==="finished"&&(s.finishTime===null||Math.abs(s.raceProgress-laps)>1e-7))||
      (s.phase!=="finished"&&s.finishTime!==null))throw new Error("Saved race checkpoint contains invalid driver state.");
    return {...s};
  });
  if(states.every(s=>s.phase==="finished"))throw new Error("A finished round must be stored as a result.");
  return {round:raw.round,elapsed:raw.elapsed,states};
}
export function parseChampionship(raw:unknown):Championship {
  if(!raw||typeof raw!=="object")throw new Error("Invalid saved championship.");
  const r=raw as Championship;
  if(r.version!==1||typeof r.id!=="string"||!r.id||r.id.length>80||!Number.isSafeInteger(r.revision)||r.revision<0||
    typeof r.name!=="string"||!r.name.trim()||r.name.length>48||typeof r.teamName!=="string"||r.teamName.length>32||
    !Array.isArray(r.venues)||r.venues.length!==3||!Array.isArray(r.entrants)||r.entrants.length!==6||
    !Array.isArray(r.ownDriverIds)||r.ownDriverIds.length!==2||new Set(r.ownDriverIds).size!==2||
    !r.ownDriverIds.every(id=>r.entrants.some(d=>d.id===id))||!Array.isArray(r.results)||r.results.length>3)throw new Error("Unsupported or invalid championship data.");
  const venues=r.venues.map(v=>{
    if(!v||typeof v.id!=="string"||!v.id||v.id.length>100||typeof v.label!=="string"||v.label.length>80)throw new Error("Invalid championship venue.");
    const track=parseTrack(v.track),setup=parseSandbox(v.setup);
    if(validateSandbox(track,setup).length||setup.drivers.length!==6||setup.drivers.some((d,i)=>!["id","name","color","paceOffset","pitLap","serviceSeconds"].every(key=>d[key as keyof SandboxDriver]===r.entrants[i]?.[key as keyof SandboxDriver])))throw new Error("Championship venue or frozen lineup is invalid.");
    return {id:v.id,label:v.label,track,setup};
  });
  if(new Set(venues.map(v=>v.id)).size!==3)throw new Error("Championship venues must be distinct.");
  const results=r.results.map((result,index)=>{
    if(!result||result.round!==index||!Array.isArray(result.classification)||result.classification.length!==6||
      new Set(result.classification.map(d=>d.driverId)).size!==6||result.classification.some((d,i)=>!r.entrants.some(e=>e.id===d.driverId)||!number(d.finishTime,0,1e7)||(i>0&&d.finishTime<result.classification[i-1].finishTime)))
      throw new Error("Invalid or duplicate championship result.");
    return {round:index,classification:result.classification.map(d=>({driverId:d.driverId,finishTime:d.finishTime}))};
  });
  const c={...r,venues,results,entrants:venues[0].setup.drivers};
  return {...c,session:r.session===null?null:parseSession(r.session,c)};
}
export function readChampionship():{championship:Championship|null;raw:string|null;error:string} {
  try {
    const raw=localStorage.getItem(championshipKey);
    if(raw===null)return {championship:null,raw:null,error:""};
    try {if(raw.length>500000)throw new Error("Saved championship is too large.");return {championship:parseChampionship(JSON.parse(raw)),raw,error:""};}
    catch{return {championship:null,raw,error:"Saved championship could not be read. Its data has been kept intact; back it up before discarding it."};}
  }catch{return {championship:null,raw:null,error:"Browser storage is unavailable. Restore access before creating or resuming a championship."};}
}
export async function saveChampionship(expected:{id:string;revision:number}|null,next:Championship):Promise<Championship> {
  const write=()=>{
    const raw=localStorage.getItem(championshipKey);
    const current=raw===null?null:parseChampionship(JSON.parse(raw));
    if(expected===null?current!==null:!current||current.id!==expected.id||current.revision!==expected.revision)throw new Error("Championship changed in another tab. Load saved championship before continuing.");
    const saved=parseChampionship({...next,revision:(current?.revision??0)+1});
    localStorage.setItem(championshipKey,JSON.stringify(saved));return saved;
  };
  return typeof navigator!=="undefined"&&navigator.locks?navigator.locks.request(championshipKey,write):write();
}
export async function discardUnreadableChampionship(expectedRaw:string):Promise<void> {
  const write=()=>{if(localStorage.getItem(championshipKey)!==expectedRaw)throw new Error("Saved championship changed; load it again before discarding.");localStorage.removeItem(championshipKey);};
  if(typeof navigator!=="undefined"&&navigator.locks)await navigator.locks.request(championshipKey,write);else write();
}
