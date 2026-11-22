import {test,expect,type Page} from "@playwright/test";
import {createDriver,newTeam,teamKey} from "../src/recruitment";
import {championshipKey} from "../src/championship";
async function enter(page:Page){
  const team={...createDriver(createDriver(newTeam(42),{id:"cup-one",name:"Cup One",color:"#64d2b6",origin:"custom",stats:{pace:70,consistency:70,pitDiscipline:70}}),{id:"cup-two",name:"Cup Two",color:"#ff665d",origin:"custom",stats:{pace:60,consistency:60,pitDiscipline:60}}),revision:1};
  await page.addInitScript(({key,team})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(team));},{key:teamKey,team});
  await page.goto("/?race=monza-2024&t=120");
  await page.getByRole("button",{name:"Local championship",exact:true}).click();
  return page.getByRole("dialog",{name:"Local championship",exact:true});
}
async function create(page:Page,laps=1){
  const panel=await enter(page);
  await panel.getByLabel("Championship laps",{exact:true}).fill(String(laps));
  await panel.getByLabel("Championship base lap seconds",{exact:true}).fill("30");
  await panel.getByLabel("Round 1 venue",{exact:true}).selectOption("replay:monza-2024");
  await panel.getByLabel("Round 2 venue",{exact:true}).selectOption("replay:session-11412");
  await panel.getByLabel("Round 3 venue",{exact:true}).selectOption("starter");
  await panel.getByRole("button",{name:"Create three-race championship",exact:true}).click();
  await expect(panel.getByTestId("cup-progress")).toHaveText("0/3 rounds complete");
  return panel;
}
test("completes a three-venue championship, saves standings and resumes between rounds",async({page})=>{
  const panel=await create(page);
  const initialBudget=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).credits,teamKey);
  for(let round=1;round<=3;round++){
    await panel.getByRole("button",{name:`Begin round ${round}`,exact:true}).click();
    await panel.getByRole("button",{name:"Advance championship lap",exact:true}).click();
    await panel.getByRole("button",{name:"Advance championship lap",exact:true}).click();
    await expect(panel.getByTestId("cup-progress")).toHaveText(`${round}/3 rounds complete`);
    await expect(panel.getByRole("status")).toContainText(`Saved ${round}/3 results`);
    const state=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),championshipKey);
    expect(state.results).toHaveLength(round);expect(state.session).toBeNull();
    if(round===1){
      await page.reload();await page.getByRole("button",{name:"Local championship",exact:true}).click();
      await expect(panel.getByTestId("cup-progress")).toHaveText("1/3 rounds complete");
    }
  }
  await expect(panel.getByRole("heading",{name:/Championship complete/})).toBeVisible();
  await expect(panel.getByRole("button",{name:/Begin round/})).toHaveCount(0);
  const before=await panel.getByRole("region",{name:"Championship standings",exact:true}).innerText();
  await page.reload();await page.getByRole("button",{name:"Local championship",exact:true}).click();
  await expect(panel.getByRole("region",{name:"Championship standings",exact:true})).toHaveText(before,{useInnerText:true});
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).credits,teamKey)).toBe(initialBudget);
  await panel.getByRole("button",{name:"Close Local championship",exact:true}).click();
  await expect(page.getByTestId("elapsed-time")).toContainText("00:02:00");
});

test("another tab's championship change locks stale controls until the saved checkpoint is loaded",async({page,context})=>{
  const panel=await create(page);
  const other=await context.newPage();
  try{
    await other.goto("/?race=monza-2024");await other.getByRole("button",{name:"Local championship",exact:true}).click();
    const viewer=other.getByRole("dialog",{name:"Local championship",exact:true});
    await expect(viewer.getByTestId("cup-progress")).toHaveText("0/3 rounds complete");
    await panel.getByRole("button",{name:"Begin round 1",exact:true}).click();
    await expect(viewer.getByRole("alert")).toContainText("another tab");
    await expect(viewer.getByRole("button",{name:"Begin round 1",exact:true})).toBeDisabled();
    await viewer.getByRole("button",{name:"Load saved championship",exact:true}).click();
    await expect(viewer.getByRole("button",{name:"Run championship race",exact:true})).toBeEnabled();
    await expect(viewer.getByTestId("cup-clock")).toHaveText("00:00:00");
  }finally{await other.close();}
});
test("restores a saved live checkpoint and pit decision paused, and persists animation on close",async({page})=>{
  const panel=await create(page,4);
  await panel.getByRole("button",{name:"Begin round 1",exact:true}).click();
  await panel.getByRole("button",{name:"Advance championship lap",exact:true}).click();
  await expect(panel.getByTestId("cup-clock")).toHaveText("00:00:30");
  await panel.getByRole("button",{name:"Box championship this lap",exact:true}).click();
  await panel.getByRole("button",{name:"Save championship checkpoint",exact:true}).click();
  await expect(panel.getByRole("status")).toContainText("checkpoint 00:00:30");
  await page.reload();await page.getByRole("button",{name:"Local championship",exact:true}).click();
  await expect(panel.getByTestId("cup-clock")).toHaveText("00:00:30");
  await expect(panel.getByText("Your driver's pit entry is queued on lap 2.",{exact:true})).toBeVisible();
  await panel.getByRole("button",{name:"Run championship race",exact:true}).click();
  await expect(panel.getByTestId("cup-clock")).not.toHaveText("00:00:30");
  await panel.getByRole("button",{name:"Pause championship race",exact:true}).click();
  const clock=await panel.getByTestId("cup-clock").innerText();
  await panel.getByRole("button",{name:"Close Local championship",exact:true}).click();
  await page.getByRole("button",{name:"Local championship",exact:true}).click();
  await expect(panel.getByTestId("cup-clock")).toHaveText(clock);
  await expect(panel.getByRole("button",{name:"Run championship race",exact:true})).toBeVisible();
});
test("failed checkpoint writes preserve the previous save and the championship fits mobile",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:"light"});
  const panel=await create(page);
  const before=await page.evaluate(key=>localStorage.getItem(key),championshipKey);
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error("Storage denied");};});
  await panel.getByRole("button",{name:"Begin round 1",exact:true}).click();
  await expect(panel.getByRole("alert")).toContainText("Storage denied");
  expect(await page.evaluate(key=>localStorage.getItem(key),championshipKey)).toBe(before);
  await expect(panel.getByRole("button",{name:"Run championship race",exact:true})).toBeDisabled();
  expect(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});
test("unreadable championship data is preserved until explicitly backed up and discarded",async({page})=>{
  const raw="{bad-cup-save";
  await page.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key:championshipKey,raw});
  const panel=await enter(page);
  await expect(panel.getByRole("alert")).toContainText("kept intact");
  expect(await page.evaluate(key=>localStorage.getItem(key),championshipKey)).toBe(raw);
  const download=page.waitForEvent("download");
  await panel.getByRole("button",{name:"Back up unreadable championship",exact:true}).click();
  const stream=await(await download).createReadStream(),chunks=[];for await(const chunk of stream!)chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString()).raw).toBe(raw);
  await panel.getByRole("button",{name:"Discard unreadable championship",exact:true}).click();
  await panel.getByRole("button",{name:"Confirm discard championship",exact:true}).click();
  await expect(panel.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),championshipKey)).toBeNull();
});
