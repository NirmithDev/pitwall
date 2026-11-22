import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import {newTrack} from "./custom-track";
import {createDriver,newTeam} from "./recruitment";
import {advanceChampionship,beginRound,championshipCall,championshipKey,createChampionship,parseChampionship,recordRound,saveChampionship,standings,type Championship} from "./championship";

const team=()=>createDriver(createDriver(newTeam(1),{id:"one",name:"One",color:"#64d2b6",origin:"custom",stats:{pace:70,consistency:70,pitDiscipline:70}}),{id:"two",name:"Two",color:"#ff665d",origin:"custom",stats:{pace:60,consistency:60,pitDiscipline:60}});
const venues=()=>Array.from({length:3},(_,i)=>({id:`venue-${i}`,label:`Venue ${i+1}`,track:{...newTrack(),name:`Venue ${i+1}`}}));
const cup=()=>createChampionship("Test Cup",team(),venues(),1,30);
const finish=(c:Championship)=>advanceChampionship(beginRound(c),1000);
describe("local three-round championship",()=>{
  beforeEach(()=>vi.stubGlobal("navigator",{}));
  afterEach(()=>vi.unstubAllGlobals());
  it("freezes a six-driver field from two signed builds and validates entry/calendar",()=>{
    const entry=team(),c=createChampionship("Test",entry,venues(),2,45);
    expect(c.entrants).toHaveLength(6);expect(c.ownDriverIds).toEqual(["recruit:one","recruit:two"]);
    entry.roster[0].name="Changed later";expect(c.entrants[0].name).toBe("One");
    expect(parseChampionship(JSON.parse(JSON.stringify(c)))).toEqual(c);
    expect(()=>createChampionship("Bad",newTeam(1),venues(),1,30)).toThrow(/two signed/);
    const duplicate=venues();duplicate[1].id=duplicate[0].id;
    expect(()=>createChampionship("Bad",team(),duplicate,1,30)).toThrow(/different/);
    expect(()=>createChampionship("Bad",team(),venues(),0,30)).toThrow(/1–50/);
  });
  it("records each fully finished round once and awards the complete points schedule",()=>{
    const c=finish(cup());
    expect(c.results).toHaveLength(1);expect(c.session).toBeNull();
    expect(standings(c).map(s=>s.points).sort((a,b)=>b-a)).toEqual([25,18,15,12,10,8]);
    expect(()=>recordRound(c)).toThrow(/fully finished/);
    expect(()=>recordRound(beginRound(c))).toThrow(/fully finished/);
    const complete=finish(finish(c));
    expect(complete.results).toHaveLength(3);expect(standings(complete).reduce((n,s)=>n+s.points,0)).toBe(264);
    expect(()=>beginRound(complete)).toThrow(/complete/);
  });
  it("uses countback then grid order when points are tied",()=>{
    const c=cup(),ids=c.entrants.map(d=>d.id);
    const order=(driverIds:string[])=>driverIds.map((driverId,i)=>({driverId,finishTime:30+i}));
    c.results=[{round:0,classification:order(ids)},{round:1,classification:order([ids[1],ids[0],...ids.slice(2)])}];
    expect(standings(c).slice(0,2).map(r=>r.driver.id)).toEqual(ids.slice(0,2));
    expect(standings(c)[0].points).toBe(43);
    c.results.push({round:2,classification:order([ids[2],ids[1],ids[0],...ids.slice(3)])});
    expect(standings(c)[0].driver.id).toBe(ids[1]);
  });
  it("resumes a serialized checkpoint with identical final times and preserves live decisions",()=>{
    let c=beginRound(cup());c=championshipCall(c,c.ownDriverIds[0],true);c=advanceChampionship(c,10);
    const resumed=parseChampionship(JSON.parse(JSON.stringify(c)));
    expect(resumed.session?.states[0].pitTarget).not.toBeNull();
    const a=advanceChampionship(c,1000),b=advanceChampionship(resumed,1000);
    expect(b.results).toEqual(a.results);expect(standings(b)).toEqual(standings(a));
    expect(()=>championshipCall(c,c.entrants[2].id,true)).toThrow(/team drivers/);
  });
  it("rejects malformed checkpoints and duplicate classifications without silently repairing them",()=>{
    const active=beginRound(cup());
    expect(()=>parseChampionship({...active,session:{...active.session,elapsed:-1}})).toThrow();
    expect(()=>parseChampionship({...active,session:{...active.session,states:active.session!.states.map(s=>({...s,raceProgress:100}))}})).toThrow();
    const complete=finish(cup());
    const duplicate=structuredClone(complete);duplicate.results[0].classification[1].driverId=duplicate.results[0].classification[0].driverId;
    expect(()=>parseChampionship(duplicate)).toThrow(/duplicate/);
    expect(()=>parseChampionship({...complete,results:[...complete.results,...complete.results]})).toThrow();
  });
  it("keeps the prior checkpoint on failed writes and rejects stale-tab updates",async()=>{
    let raw:string|null=null;
    vi.stubGlobal("localStorage",{getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;}});
    const saved=await saveChampionship(null,cup());
    const next=await saveChampionship(saved,beginRound(saved));
    await expect(saveChampionship(saved,saved)).rejects.toThrow(/another tab/);
    const old=raw;
    vi.stubGlobal("localStorage",{getItem:()=>raw,setItem:()=>{throw new Error("Storage denied");}});
    await expect(saveChampionship(next,advanceChampionship(next,1))).rejects.toThrow(/denied/);
    expect(raw).toBe(old);expect(JSON.parse(raw!)["session"]).not.toBeNull();expect(championshipKey).toContain("championship");
  });
});
