import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import {newTrack} from "./custom-track";
import {advanceChampionship,beginRound,championshipKey,createChampionship,linkLegacyRewardTeam,parseChampionship} from "./championship";
import {claimRoundReward,roundReward} from "./championship-rewards";
import {createDriver,maximumCredits,newTeam,parseTeam,resetTeam,saveTeam,teamKey} from "./recruitment";

function locks(){
  const pending=new Map<string,Promise<unknown>>();
  return {request<T>(name:string,work:()=>T|Promise<T>):Promise<T>{
    const prior=pending.get(name)??Promise.resolve();
    const result=prior.catch(()=>{}).then(work);
    pending.set(name,result.then(()=>{},()=>{}));return result;
  }};
}
const originalTeam=()=>({...createDriver(createDriver(newTeam(1),{id:"one",name:"One",color:"#64d2b6",origin:"custom",stats:{pace:70,consistency:70,pitDiscipline:70}}),{id:"two",name:"Two",color:"#ff665d",origin:"custom",stats:{pace:60,consistency:60,pitDiscipline:60}}),revision:1});
describe("atomic, claim-once championship rewards",()=>{
  let data:Map<string,string>;
  beforeEach(()=>{
    data=new Map();vi.stubGlobal("navigator",{locks:locks()});
    vi.stubGlobal("localStorage",{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)});
  });
  afterEach(()=>vi.unstubAllGlobals());
  function fixture(finished=true){
    const team=originalTeam();
    let cup=createChampionship("Reward Cup",team,Array.from({length:3},(_,i)=>({id:`venue-${i}`,label:`Venue ${i+1}`,track:newTrack()})),1,30);
    cup=beginRound(cup);if(finished)cup=advanceChampionship(cup,1000);
    data.set(teamKey,JSON.stringify(team));data.set(championshipKey,JSON.stringify(cup));return {team,cup};
  }
  it("migrates old team records and credits the saved payout plus its receipt in one record",async()=>{
    const {team,cup}=fixture();
    const {rewardClaims:_,...legacy}=team;data.set(teamKey,JSON.stringify(legacy));
    expect(parseTeam(legacy).rewardClaims).toEqual([]);
    const payout=roundReward(cup,0),result=await claimRoundReward(cup.id,0);
    expect(result.alreadyClaimed).toBe(false);expect(result.receipt.amount).toBe(200+20*payout.teamPoints);
    const stored=parseTeam(JSON.parse(data.get(teamKey)!));
    expect(stored.credits).toBe(team.credits+payout.amount);expect(stored.rewardClaims).toHaveLength(1);
    expect(stored.roster).toEqual(team.roster);expect(stored.lineup).toEqual(team.lineup);
    expect(JSON.parse(data.get(championshipKey)!).results).toEqual(cup.results);
  });
  it("makes concurrent requests and retries idempotent without adding another receipt or revision",async()=>{
    const {team,cup}=fixture(),payout=roundReward(cup,0).amount;
    const responses=await Promise.all(Array.from({length:8},()=>claimRoundReward(cup.id,0)));
    expect(responses.filter(r=>!r.alreadyClaimed)).toHaveLength(1);
    const stored=JSON.parse(data.get(teamKey)!);expect(stored.credits).toBe(team.credits+payout);expect(stored.rewardClaims).toHaveLength(1);
    const before=data.get(teamKey);await claimRoundReward(cup.id,0);expect(data.get(teamKey)).toBe(before);
  });
  it("rejects unfinished, uncommitted and replaced results without touching the team",async()=>{
    const {cup}=fixture(false),before=data.get(teamKey);
    await expect(claimRoundReward(cup.id,0)).rejects.toThrow(/Finish and save/);
    advanceChampionship(cup,1000); // An unsaved view is deliberately insufficient.
    await expect(claimRoundReward(cup.id,0)).rejects.toThrow(/Finish and save/);
    await expect(claimRoundReward("another-cup",0)).rejects.toThrow(/changed/);
    expect(data.get(teamKey)).toBe(before);
  });
  it("does not mark a claim on failed writes and safely recovers a lost acknowledgement",async()=>{
    const {team,cup}=fixture(),before=data.get(teamKey);
    const write=(key:string,value:string)=>data.set(key,value);
    vi.stubGlobal("localStorage",{getItem:(key:string)=>data.get(key)??null,setItem:()=>{throw new Error("Storage denied");}});
    await expect(claimRoundReward(cup.id,0)).rejects.toThrow(/denied/);expect(data.get(teamKey)).toBe(before);
    vi.stubGlobal("localStorage",{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{write(key,value);throw new Error("Acknowledgement lost");}});
    await expect(claimRoundReward(cup.id,0)).rejects.toThrow(/Acknowledgement/);
    vi.stubGlobal("localStorage",{getItem:(key:string)=>data.get(key)??null,setItem:write});
    const retry=await claimRoundReward(cup.id,0);expect(retry.alreadyClaimed).toBe(true);
    expect(retry.team.credits).toBe(team.credits+roundReward(cup,0).amount);expect(retry.team.rewardClaims).toHaveLength(1);
  });
  it("preserves newer recruitment changes and makes a stale purchase reload after a reward",async()=>{
    const {team,cup}=fixture();
    const newer=await saveTeam(team,{...team,name:"Updated Racing"});
    const paid=await claimRoundReward(cup.id,0);expect(paid.team.name).toBe("Updated Racing");expect(paid.team.roster).toEqual(newer.roster);
    await expect(saveTeam(newer,{...newer,credits:newer.credits-250})).rejects.toThrow(/another tab/);
    expect(JSON.parse(data.get(teamKey)!).credits).toBe(paid.team.credits);
  });
  it("keeps a fresh team from reclaiming an older team's championship",async()=>{
    const {cup}=fixture();await claimRoundReward(cup.id,0);
    const fresh=await resetTeam();expect(fresh.rewardClaims).toEqual([]);
    await expect(claimRoundReward(cup.id,0)).rejects.toThrow(/different recruiting team/);
    expect(JSON.parse(data.get(teamKey)!).credits).toBe(12000);
  });
  it("links legacy cups only through their original signed profiles and persists the owner before paying",async()=>{
    const {team,cup}=fixture();const legacy={...cup};delete legacy.rewardTeamId;
    expect(parseChampionship(legacy).rewardTeamId).toBeUndefined();data.set(championshipKey,JSON.stringify(legacy));
    await expect(claimRoundReward(cup.id,0)).rejects.toThrow(/Link this older/);
    expect(()=>linkLegacyRewardTeam(legacy,newTeam(42))).toThrow(/original two/);
    const linked=linkLegacyRewardTeam(legacy,team);data.set(championshipKey,JSON.stringify(linked));
    expect((await claimRoundReward(cup.id,0)).alreadyClaimed).toBe(false);
  });
  it("refuses unsafe browser coordination and over-cap balances rather than partially paying",async()=>{
    const {team,cup}=fixture();vi.stubGlobal("navigator",{});
    await expect(claimRoundReward(cup.id,0)).rejects.toThrow(/Web Locks/);
    vi.stubGlobal("navigator",{locks:locks()});data.set(teamKey,JSON.stringify({...team,credits:maximumCredits}));
    await expect(claimRoundReward(cup.id,0)).rejects.toThrow(/Spend some credits/);
    const stored=parseTeam(JSON.parse(data.get(teamKey)!));expect(stored.credits).toBe(maximumCredits);expect(stored.rewardClaims).toEqual([]);
  });
  it("accepts earned balances above starting funds but retains every duplicate-proof receipt at the history limit",async()=>{
    const {team,cup}=fixture();data.set(teamKey,JSON.stringify({...team,credits:12000}));
    const paid=await claimRoundReward(cup.id,0);expect(parseTeam(paid.team).credits).toBeGreaterThan(12000);
    const history=Array.from({length:1000},(_,i)=>({...paid.receipt,championshipId:`previous-${i}`}));
    data.set(teamKey,JSON.stringify({...team,rewardClaims:history}));
    await expect(claimRoundReward(cup.id,0)).rejects.toThrow(/history limit/);
    expect(parseTeam(JSON.parse(data.get(teamKey)!)).rewardClaims).toHaveLength(1000);
    expect(()=>parseTeam({...team,rewardClaims:[paid.receipt,paid.receipt]})).toThrow(/Duplicate/);
  });
});
