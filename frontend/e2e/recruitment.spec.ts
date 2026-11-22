import {test,expect} from "@playwright/test";
import {newTeam,signingFee,releaseRefund,teamKey} from "../src/recruitment";

test("recruits generated prospects, preserves the market and budget on reload, scouts and releases", async ({page}) => {
  const initial={...newTeam(42),revision:1}, prospect=initial.market[0];
  await page.addInitScript(({key,team})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(team));},{key:teamKey,team:initial});
  await page.goto("/?race=monza-2024&t=120");
  await page.getByRole("button",{name:"Driver recruitment",exact:true}).click();
  const panel=page.getByRole("dialog",{name:"Driver recruitment",exact:true});
  await panel.getByRole("article",{name:`Market ${prospect.name}`,exact:true}).getByRole("button",{name:/^Sign /}).click();
  const remaining=12000-signingFee(prospect.stats);
  await expect(panel.getByTestId("team-credits")).toHaveText(`${remaining.toLocaleString("en-US")} credits`);
  await expect(panel.getByTestId("roster-count")).toHaveText("1/6 drivers");
  await page.reload();
  await page.getByRole("button",{name:"Driver recruitment",exact:true}).click();
  await expect(panel.getByRole("article",{name:`Signed ${prospect.name}`,exact:true})).toBeVisible();
  await expect(panel.getByRole("article",{name:`Market ${prospect.name}`,exact:true})).toHaveCount(0);
  await expect(panel.getByTestId("team-credits")).toHaveText(`${remaining.toLocaleString("en-US")} credits`);
  await panel.getByRole("button",{name:/^Release /}).click();
  await expect(panel.getByTestId("roster-count")).toHaveText("0/6 drivers");
  const after=remaining+releaseRefund(prospect)-250;
  await panel.getByRole("button",{name:"Scout new market · 250 credits",exact:true}).click();
  await expect(panel.getByTestId("team-credits")).toHaveText(`${after.toLocaleString("en-US")} credits`);
  await expect(panel.getByRole("region",{name:"Driver market",exact:true}).getByRole("article")).toHaveCount(6);
  const download=page.waitForEvent("download");
  await panel.getByRole("button",{name:"Export team JSON",exact:true}).click();
  const stream=await(await download).createReadStream(),chunks=[];
  for await(const chunk of stream!)chunks.push(chunk);
  const exported=JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.credits).toBe(after);expect(exported.roster).toHaveLength(0);
});

test("custom builds respect points and swapping the lineup changes the sandbox and new room setup", async ({page}) => {
  await page.goto("/?race=monza-2024&t=120");
  await page.getByRole("button",{name:"Custom circuit studio",exact:true}).click();
  await page.getByRole("button",{name:"Circuit race sandbox",exact:true}).click();
  await page.getByRole("button",{name:"Advance one lap",exact:true}).click();
  await page.getByRole("button",{name:"Recruit and manage drivers",exact:true}).click();
  const panel=page.getByRole("dialog",{name:"Driver recruitment",exact:true});
  const custom=panel.getByRole("region",{name:"Custom driver builder",exact:true});
  await custom.getByLabel("Custom driver name",{exact:true}).fill("Apex");
  await custom.getByLabel("Custom pace",{exact:true}).fill("100");
  await expect(custom.getByRole("button",{name:"Create and sign custom driver",exact:true})).toBeDisabled();
  await custom.getByLabel("Custom consistency",{exact:true}).fill("60");
  await custom.getByLabel("Custom pit discipline",{exact:true}).fill("50");
  await custom.getByRole("button",{name:"Create and sign custom driver",exact:true}).click();
  await expect(panel.getByTestId("roster-count")).toHaveText("1/6 drivers");
  await custom.getByLabel("Custom driver name",{exact:true}).fill("Crew");
  await custom.getByLabel("Custom pace",{exact:true}).fill("50");
  await custom.getByLabel("Custom consistency",{exact:true}).fill("50");
  await custom.getByRole("button",{name:"Create and sign custom driver",exact:true}).click();
  await expect(panel.getByTestId("roster-count")).toHaveText("2/6 drivers");
  const state=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),teamKey);
  await panel.getByLabel("Race seat 1",{exact:true}).selectOption(state.roster[0].id);
  await panel.getByLabel("Race seat 2",{exact:true}).selectOption(state.roster[1].id);
  await panel.getByRole("button",{name:"Swap race seats",exact:true}).click();
  await panel.getByRole("button",{name:"Apply lineup and restart sandbox",exact:true}).click();
  const sandbox=page.getByRole("region",{name:"Circuit race sandbox",exact:true});
  await expect(sandbox.getByLabel("Grid 1 driver name",{exact:true})).toHaveValue("Crew");
  await expect(sandbox.getByLabel("Grid 2 driver name",{exact:true})).toHaveValue("Apex");
  await expect(sandbox.getByLabel("Grid 1 pace offset",{exact:true})).toHaveValue("2.4");
  await expect(sandbox.getByLabel("Grid 2 pace offset",{exact:true})).toHaveValue("-1.68");
  await expect(sandbox.getByLabel("Grid 2 service seconds",{exact:true})).toHaveValue("3");
  await expect(sandbox.getByTestId("sandbox-clock")).toHaveText("00:00:00");
  await expect(sandbox.getByLabel("Grid 3 driver name",{exact:true})).toHaveValue("Driver 3");
  await sandbox.getByRole("button",{name:"Host this setup with friends",exact:true}).click();
  const room=page.getByRole("dialog",{name:"Multiplayer rooms",exact:true});
  await room.getByLabel("Guest name",{exact:true}).fill("Recruiter");
  await room.getByRole("button",{name:"Create private room",exact:true}).click();
  await expect(room.getByRole("button",{name:"Claim Crew",exact:true})).toBeVisible();
  await expect(room.getByRole("button",{name:"Claim Apex",exact:true})).toBeVisible();
});

test("recruitment is usable on mobile and failed storage writes do not spend credits", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({colorScheme:"light"});
  await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error("Storage denied");};});
  await page.goto("/?race=monza-2024");
  await page.getByRole("button",{name:"Driver recruitment",exact:true}).click();
  const panel=page.getByRole("dialog",{name:"Driver recruitment",exact:true});
  await expect(panel.getByRole("alert")).toBeVisible();
  await panel.getByRole("region",{name:"Custom driver builder",exact:true}).getByRole("button",{name:"Create and sign custom driver",exact:true}).click();
  await expect(panel.getByTestId("team-credits")).toHaveText("12,000 credits");
  await expect(panel.getByTestId("roster-count")).toHaveText("0/6 drivers");
  expect(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});

test("another tab's purchase cannot be overwritten by a stale team screen", async ({page,context}) => {
  await page.goto("/?race=monza-2024");
  await page.getByRole("button",{name:"Driver recruitment",exact:true}).click();
  const panel=page.getByRole("dialog",{name:"Driver recruitment",exact:true});
  await expect(panel.getByRole("button",{name:"Create and sign custom driver",exact:true})).toBeEnabled();
  const other=await context.newPage();
  try {
    await other.goto("/?race=monza-2024");
    await other.getByRole("button",{name:"Driver recruitment",exact:true}).click();
    await other.getByRole("button",{name:"Create and sign custom driver",exact:true}).click();
    await expect(panel.getByRole("alert")).toContainText("another tab");
    await panel.getByRole("button",{name:"Scout new market · 250 credits",exact:true}).click();
    await expect(panel.getByRole("alert")).toContainText("another tab");
    await panel.getByRole("button",{name:"Load latest team",exact:true}).click();
    await expect(panel.getByTestId("roster-count")).toHaveText("1/6 drivers");
    await expect(panel.getByTestId("team-credits")).toHaveText("7,325 credits");
  } finally {await other.close();}
});

test("unreadable team data stays intact until a fresh-team reset is explicitly confirmed", async ({page}) => {
  const raw="{broken-team-json";
  await page.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key:teamKey,raw});
  await page.goto("/?race=monza-2024");
  await page.getByRole("button",{name:"Driver recruitment",exact:true}).click();
  const panel=page.getByRole("dialog",{name:"Driver recruitment",exact:true});
  await expect(panel.getByRole("alert")).toContainText("could not be read");
  expect(await page.evaluate(key=>localStorage.getItem(key),teamKey)).toBe(raw);
  const download=page.waitForEvent("download");
  await panel.getByRole("button",{name:"Back up stored team data",exact:true}).click();
  const stream=await(await download).createReadStream(),chunks=[];
  for await(const chunk of stream!)chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString()).raw).toBe(raw);
  await panel.getByRole("button",{name:"Start fresh team",exact:true}).click();
  await panel.getByRole("button",{name:"Keep current team",exact:true}).click();
  expect(await page.evaluate(key=>localStorage.getItem(key),teamKey)).toBe(raw);
  await panel.getByRole("button",{name:"Start fresh team",exact:true}).click();
  await panel.getByRole("button",{name:"Confirm fresh team",exact:true}).click();
  await expect(panel.getByRole("alert")).toHaveCount(0);
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),teamKey);
  expect(saved.credits).toBe(12000);expect(saved.roster).toEqual([]);expect(saved.market).toHaveLength(6);
});
