import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {newTrack} from "./custom-track";
import {parseSandbox, sandboxDefaults} from "./sandbox";
import {applyLineup, assignRecruitToGrid, assignSeat, availableLineup, createDriver, driverEffects, ensureTeam, generateMarket, newTeam, parseTeam, refreshMarket, releaseDriver, releaseRefund, saveTeam, signDriver, signingFee, teamKey, type RecruitDriver} from "./recruitment";

const rookie = (id: string, stats = {pace:70,consistency:70,pitDiscipline:70}): RecruitDriver => ({id,name:id,color:"#64d2b6",origin:"custom",stats});
describe("fictional recruiting and team economy", () => {
  let stored: Map<string,string>;
  beforeEach(() => {
    stored = new Map();
    vi.stubGlobal("navigator",{});
    vi.stubGlobal("localStorage",{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value)});
  });
  afterEach(() => vi.unstubAllGlobals());
  it("generates reproducible markets with bounded varied stats and unique identities", () => {
    expect(generateMarket(42,0)).toEqual(generateMarket(42,0));
    expect(generateMarket(42,1)).not.toEqual(generateMarket(42,0));
    const ids = new Set<string>(), ratings = new Set<number>();
    for (let seed=1;seed<=100;seed++) for(const d of generateMarket(seed,0)) {
      expect(ids.has(d.id)).toBe(false);ids.add(d.id);
      for(const n of Object.values(d.stats)){expect(n).toBeGreaterThanOrEqual(45);expect(n).toBeLessThanOrEqual(90);ratings.add(n);}
    }
    expect(ratings.size).toBeGreaterThan(30);
  });
  it("charges exactly once when signing, prevents duplicate signing and prices stronger builds higher", () => {
    const team=newTeam(42), driver=team.market[0], hired=signDriver(team,driver.id);
    expect(hired.credits).toBe(12000-signingFee(driver.stats));
    expect(hired.market.some(d=>d.id===driver.id)).toBe(false);
    expect(hired.roster).toEqual([driver]);
    expect(()=>signDriver(hired,driver.id)).toThrow(/available/);
    expect(()=>signDriver({...team,credits:0},driver.id)).toThrow(/credits/);
    expect(signingFee({pace:100,consistency:100,pitDiscipline:100})).toBeGreaterThan(signingFee({pace:50,consistency:50,pitDiscipline:50}));
    expect(team.roster).toHaveLength(0);
  });
  it("enforces custom point limits, unique names, valid stats and six roster slots", () => {
    expect(()=>createDriver(newTeam(1),rookie("Elite",{pace:100,consistency:100,pitDiscipline:100}))).toThrow(/210/);
    for(const bad of [NaN,9,101,20.5])expect(()=>createDriver(newTeam(1),rookie("Bad",{pace:bad,consistency:10,pitDiscipline:10}))).toThrow();
    let t=newTeam(1);
    for(let i=0;i<6;i++)t=createDriver(t,rookie(`Rookie ${i}`,{pace:10,consistency:10,pitDiscipline:10}));
    expect(()=>createDriver(t,rookie("Overflow"))).toThrow(/full/);
    const one=createDriver(newTeam(1),rookie("Nova"));
    expect(()=>createDriver(one,{...rookie("other"),name:"nova"})).toThrow(/name/);
  });
  it("swaps occupied seats without duplicating drivers and release clears seats with a partial refund", () => {
    let t=createDriver(createDriver(newTeam(1),rookie("One")),rookie("Two"));
    t=assignSeat(assignSeat(t,0,"One"),1,"Two");
    const swapped=assignSeat(t,0,"Two");
    expect(swapped.lineup).toEqual(["Two","One"]);
    expect(swapped.credits).toBe(t.credits);
    const released=releaseDriver(swapped,"One");
    expect(released.lineup).toEqual(["Two",null]);
    expect(released.credits).toBe(t.credits+releaseRefund(t.roster[0]));
    expect(released.credits).toBeLessThan(12000-signingFee(t.roster[1].stats));
    expect(()=>assignSeat(released,1,"One")).toThrow(/Sign/);
  });
  it("charges scouting while keeping signed drivers/lineup, and retains a valid saved profile", () => {
    let t=createDriver(newTeam(42),rookie("One"));t=assignSeat(t,0,"One");
    const next=refreshMarket(t);
    expect(next.credits).toBe(t.credits-250);expect(next.market).toHaveLength(6);
    expect(next.market).not.toEqual(t.market);expect(next.roster).toEqual(t.roster);expect(next.lineup).toEqual(t.lineup);
    expect(parseTeam(JSON.parse(JSON.stringify(next)))).toEqual(next);
    expect(()=>refreshMarket({...t,credits:249})).toThrow(/credits/);
    expect(()=>parseTeam({...t,lineup:["One","One"]})).toThrow(/lineup/);
    expect(()=>parseTeam({...t,credits:-1})).toThrow();
    expect(()=>parseTeam({...t,market:[t.roster[0]]})).toThrow();
  });
  it("applies the two selected builds without mutating opponents, geometry or scheduled stops", () => {
    let t=createDriver(createDriver(newTeam(1),rookie("Fast",{pace:100,consistency:100,pitDiscipline:10})),rookie("Crew",{pace:10,consistency:90,pitDiscipline:100}));
    t=assignSeat(assignSeat(t,0,"Fast"),1,"Crew");
    const setup=sandboxDefaults(newTrack()), next=applyLineup(t,setup);
    expect(driverEffects(t.roster[0].stats)).toEqual({paceOffset:-3.6,serviceSeconds:4.6});
    expect(next.drivers[0]).toMatchObject({id:"recruit:Fast",name:"Fast",paceOffset:-3.6,serviceSeconds:4.6,pitLap:1});
    expect(next.drivers[1]).toMatchObject({name:"Crew",serviceSeconds:1,pitLap:0});
    expect(next.drivers[2]).toEqual(setup.drivers[2]);expect(next.pitControls).toEqual(setup.pitControls);
    expect(parseSandbox(next)).toEqual(next);expect(setup.drivers[0].name).toBe("Driver 1");
    expect(()=>applyLineup(newTeam(42),setup)).toThrow(/two signed/);
  });
  it("initializes once even under repeated mounts, detects stale saves and never spends after a storage failure", async () => {
    const initial=newTeam(42), saved=await ensureTeam(initial);
    expect(await ensureTeam(newTeam(99))).toEqual(saved);
    const signed=await saveTeam(saved,signDriver(saved,saved.market[0].id));
    await expect(saveTeam(saved,refreshMarket(saved))).rejects.toThrow(/another tab/);
    expect(JSON.parse(stored.get(teamKey)!)).toEqual(signed);
    vi.stubGlobal("localStorage",{getItem:()=>JSON.stringify(signed),setItem:()=>{throw new Error("Storage denied");}});
    await expect(saveTeam(signed,refreshMarket(signed))).rejects.toThrow(/denied/);
    expect(JSON.parse(stored.get(teamKey)!)).toEqual(signed);
  });
  it("fills empty team seats on signing and applies one signed seat without requiring a full team",()=>{
    const team=createDriver(newTeam(1),rookie("Solo"));
    expect(team.lineup).toEqual(["Solo",null]);
    const setup=sandboxDefaults(newTrack()),next=availableLineup(team,setup);
    expect(next.drivers[0].name).toBe("Solo");expect(next.drivers[1]).toEqual(setup.drivers[1]);
    const released=releaseDriver(team,"Solo");expect(availableLineup(released,setup)).toEqual(setup);
  });
  it("swaps signed builds between grid slots without duplicating IDs or moving planned stops",()=>{
    const team=createDriver(createDriver(newTeam(1),rookie("One")),rookie("Two"));
    const setup=applyLineup(team,sandboxDefaults(newTrack()));
    const next=assignRecruitToGrid(team,setup,1,"One");
    expect(next.drivers.map(d=>d.id)).toEqual(["recruit:Two","recruit:One",setup.drivers[2].id]);
    expect(next.drivers.map(d=>d.pitLap)).toEqual(setup.drivers.map(d=>d.pitLap));
    expect(()=>assignRecruitToGrid(team,setup,9,"One")).toThrow();
    expect(()=>assignRecruitToGrid(team,setup,0,"not signed")).toThrow();
  });
});
