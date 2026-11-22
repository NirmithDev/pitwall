import {test,expect,type Page} from "@playwright/test";
import {newTrack} from "../src/custom-track";
import {advanceChampionship,beginRound,championshipKey,createChampionship} from "../src/championship";
import {roundReward} from "../src/championship-rewards";
import {createDriver,newTeam,signingFee,teamKey} from "../src/recruitment";

function fixtures(){
  const team={...createDriver(createDriver(newTeam(42),{id:"reward-one",name:"Reward One",color:"#64d2b6",origin:"custom",stats:{pace:70,consistency:70,pitDiscipline:70}}),{id:"reward-two",name:"Reward Two",color:"#ff665d",origin:"custom",stats:{pace:60,consistency:60,pitDiscipline:60}}),revision:1};
  const cup=advanceChampionship(beginRound(createChampionship("Prize Cup",team,Array.from({length:3},(_,i)=>({id:`prize-${i}`,label:`Prize venue ${i+1}`,track:newTrack()})),1,30)),1000);
  return {team,cup};
}
async function openSaved(page:Page,legacy=false){
  const {team,cup}=fixtures();if(legacy)delete cup.rewardTeamId;
  await page.addInitScript(({teamKey,cupKey,team,cup})=>{
    if(!localStorage.getItem(teamKey))localStorage.setItem(teamKey,JSON.stringify(team));
    if(!localStorage.getItem(cupKey))localStorage.setItem(cupKey,JSON.stringify(cup));
  },{teamKey,cupKey:championshipKey,team,cup});
  await page.goto("/?race=monza-2024");await page.getByRole("button",{name:"Local championship",exact:true}).click();
  return {team,cup,panel:page.getByRole("dialog",{name:"Local championship",exact:true})};
}
test("a saved reward survives reload and can fund another signed build",async({page})=>{
  const {team,cup,panel}=await openSaved(page),amount=roundReward(cup,0).amount;
  await panel.getByRole("button",{name:"Claim round 1 reward",exact:true}).click();
  await expect(panel.getByTestId("reward-status")).toContainText(`+${amount.toLocaleString("en-US")} credits`);
  await expect(panel.getByTestId("cup-recruiting-credits")).toHaveText(`${(team.credits+amount).toLocaleString("en-US")} recruiting credits`);
  await page.reload();await page.getByRole("button",{name:"Local championship",exact:true}).click();
  await expect(panel.getByText(`Round 1 claimed · +${amount.toLocaleString("en-US")} credits`,{exact:true})).toBeVisible();
  await expect(panel.getByRole("button",{name:"Claim round 1 reward",exact:true})).toHaveCount(0);
  await panel.getByRole("button",{name:"Begin round 2",exact:true}).click();
  await panel.getByRole("button",{name:"Advance championship lap",exact:true}).click();
  await panel.getByRole("button",{name:"Advance championship lap",exact:true}).click();
  await expect(panel.getByRole("status")).toContainText("Saved 2/3 results");
  const progressed=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),championshipKey);
  const secondAmount=roundReward(progressed,1).amount;
  await panel.getByRole("button",{name:"Claim round 2 reward",exact:true}).click();
  await expect(panel.getByTestId("reward-status")).toContainText("Round 2 reward claimed");
  await panel.getByRole("button",{name:"Close Local championship",exact:true}).click();
  await page.getByRole("button",{name:"Driver recruitment",exact:true}).click();
  const manager=page.getByRole("dialog",{name:"Driver recruitment",exact:true});
  await expect(manager.getByRole("region",{name:"Championship earnings",exact:true})).toContainText("Prize Cup");
  await manager.getByLabel("Custom driver name",{exact:true}).fill("Prize rookie");
  await manager.getByRole("button",{name:"Create and sign custom driver",exact:true}).click();
  await expect(manager.getByTestId("roster-count")).toHaveText("3/6 drivers");
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),teamKey);
  expect(saved.credits).toBe(team.credits+amount+secondAmount-signingFee({pace:70,consistency:70,pitDiscipline:70}));expect(saved.rewardClaims).toHaveLength(2);
});

test("a denied reward write leaves credits and receipt unchanged and a retry pays once on mobile",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:"light"});
  const {team,cup,panel}=await openSaved(page),amount=roundReward(cup,0).amount;
  await page.evaluate(key=>{const original=Storage.prototype.setItem;let fail=true;Storage.prototype.setItem=function(k,v){if(k===key&&fail){fail=false;throw new Error("Reward write denied");}return original.call(this,k,v);};},teamKey);
  await panel.getByRole("button",{name:"Claim round 1 reward",exact:true}).click();
  await expect(panel.getByRole("alert")).toContainText("Reward write denied");
  const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),teamKey);
  expect(before.credits).toBe(team.credits);expect(before.rewardClaims).toEqual([]);
  await panel.getByRole("button",{name:"Claim round 1 reward",exact:true}).click();
  await expect(panel.getByTestId("reward-status")).toContainText("reward claimed");
  const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),teamKey);
  expect(after.credits).toBe(team.credits+amount);expect(after.rewardClaims).toHaveLength(1);
  expect(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});

test("two tabs queued on the real browser lock claim one receipt and one payout",async({page,context})=>{
  const {team,cup,panel}=await openSaved(page),amount=roundReward(cup,0).amount;
  const other=await context.newPage();
  try{
    await other.goto("/?race=monza-2024");await other.getByRole("button",{name:"Local championship",exact:true}).click();
    const second=other.getByRole("dialog",{name:"Local championship",exact:true});
    await page.evaluate(key=>{
      const state=window as unknown as {rewardLockHeld:boolean;releaseRewardLock?:()=>void};
      state.rewardLockHeld=false;
      void navigator.locks.request(key,()=>new Promise<void>(resolve=>{state.rewardLockHeld=true;state.releaseRewardLock=resolve;}));
    },teamKey);
    await expect.poll(()=>page.evaluate(()=>(window as unknown as {rewardLockHeld:boolean}).rewardLockHeld)).toBe(true);
    await Promise.all([panel.getByRole("button",{name:"Claim round 1 reward",exact:true}).click(),second.getByRole("button",{name:"Claim round 1 reward",exact:true}).click()]);
    await expect(panel.getByTestId("reward-status")).toHaveText("Saving reward…");await expect(second.getByTestId("reward-status")).toHaveText("Saving reward…");
    await page.evaluate(()=>(window as unknown as {releaseRewardLock?:()=>void}).releaseRewardLock?.());
    await expect(panel.getByText(`Round 1 claimed · +${amount.toLocaleString("en-US")} credits`,{exact:true})).toBeVisible();
    await expect(second.getByText(`Round 1 claimed · +${amount.toLocaleString("en-US")} credits`,{exact:true})).toBeVisible();
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),teamKey);
    expect(saved.credits).toBe(team.credits+amount);expect(saved.rewardClaims).toHaveLength(1);expect(saved.revision).toBe(team.revision+1);
  }finally{await page.evaluate(()=>(window as unknown as {releaseRewardLock?:()=>void}).releaseRewardLock?.());await other.close();}
});

test("legacy cups link to their original team and a team reset cannot reclaim paid rounds",async({page})=>{
  const {panel}=await openSaved(page,true);
  await expect(panel.getByRole("button",{name:"Claim round 1 reward",exact:true})).toBeDisabled();
  await panel.getByRole("button",{name:"Link older cup to original team",exact:true}).click();
  await expect(panel.getByTestId("reward-status")).toContainText("Older cup linked");
  await panel.getByRole("button",{name:"Claim round 1 reward",exact:true}).click();
  await expect(panel.getByTestId("reward-status")).toContainText("reward claimed");
  await panel.getByRole("button",{name:"Close Local championship",exact:true}).click();
  await page.getByRole("button",{name:"Driver recruitment",exact:true}).click();
  await page.getByRole("button",{name:"Start fresh team",exact:true}).click();await page.getByRole("button",{name:"Confirm fresh team",exact:true}).click();
  await expect(page.getByTestId("roster-count")).toHaveText("0/6 drivers");
  await page.getByRole("button",{name:"Close Driver recruitment",exact:true}).click();
  await page.getByRole("button",{name:"Local championship",exact:true}).click();
  await expect(panel.getByText("This cup belongs to another recruiting team. A fresh team cannot claim its rewards.",{exact:true})).toBeVisible();
  await expect(panel.getByRole("button",{name:"Claim round 1 reward",exact:true})).toBeDisabled();
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),teamKey);expect(saved.credits).toBe(12000);expect(saved.rewardClaims).toEqual([]);
});

test("unsupported browser coordination disables claims without changing the balance",async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,"locks",{value:undefined,configurable:true}));
  const {team,panel}=await openSaved(page);
  await expect(panel.getByText("This browser cannot coordinate reward claims across tabs. Web Locks support is required.",{exact:true})).toBeVisible();
  await expect(panel.getByRole("button",{name:"Claim round 1 reward",exact:true})).toBeDisabled();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).credits,teamKey)).toBe(team.credits);
});
