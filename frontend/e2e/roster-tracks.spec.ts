import {test,expect} from "@playwright/test";
import {createDriver,newTeam,teamKey} from "../src/recruitment";

test("a signing appears in an open sandbox and can be synced or swapped without reopening the studio",async({page})=>{
  await page.goto("/?race=monza-2024&t=120");
  await page.getByRole("button",{name:"Custom circuit studio",exact:true}).click();
  await page.getByRole("button",{name:"Circuit race sandbox",exact:true}).click();
  const sandbox=page.getByRole("region",{name:"Circuit race sandbox",exact:true});
  await sandbox.getByRole("button",{name:"Advance one lap",exact:true}).click();
  await sandbox.getByRole("button",{name:"Recruit and manage drivers",exact:true}).click();
  const recruit=page.getByRole("dialog",{name:"Driver recruitment",exact:true});
  await recruit.getByLabel("Custom driver name",{exact:true}).fill("Synced rookie");
  await recruit.getByRole("button",{name:"Create and sign custom driver",exact:true}).click();
  await expect(recruit.getByTestId("roster-count")).toHaveText("1/6 drivers");
  await recruit.getByRole("button",{name:"Close Driver recruitment",exact:true}).click();
  await expect(sandbox.getByRole("heading",{name:"Signed team drivers · 1 available",exact:true})).toBeVisible();
  await expect(sandbox.getByTestId("sandbox-clock")).toHaveText("00:01:30");
  await sandbox.getByRole("button",{name:"Sync team lineup and restart",exact:true}).click();
  await expect(sandbox.getByLabel("Grid 1 driver name",{exact:true})).toHaveValue("Synced rookie");
  await expect(sandbox.getByTestId("sandbox-clock")).toHaveText("00:00:00");
  await sandbox.getByLabel("Signed driver for grid 2",{exact:true}).selectOption({label:"Synced rookie"});
  await expect(sandbox.getByLabel("Grid 2 driver name",{exact:true})).toHaveValue("Synced rookie");
  await expect(sandbox.getByLabel("Grid 1 driver name",{exact:true})).toHaveValue("Driver 2");
});

test("race this circuit uses the current replay outline and signed lineup, then hosts the copied venue",async({page})=>{
  const team={...createDriver(createDriver(newTeam(42),{id:"apex",name:"Venue Apex",color:"#64d2b6",origin:"custom",stats:{pace:70,consistency:70,pitDiscipline:70}}),{id:"crew",name:"Venue Crew",color:"#ff665d",origin:"custom",stats:{pace:60,consistency:60,pitDiscipline:60}}),revision:1};
  await page.addInitScript(({key,team})=>localStorage.setItem(key,JSON.stringify(team)),{key:teamKey,team});
  await page.goto("/?race=monza-2024&t=120");
  await page.getByRole("button",{name:"Race this circuit",exact:true}).click();
  const studio=page.getByRole("dialog",{name:"Custom circuit studio",exact:true});
  const sandbox=studio.getByRole("region",{name:"Circuit race sandbox",exact:true});
  await expect(sandbox).toBeVisible();
  await expect(sandbox.getByLabel("Grid 1 driver name",{exact:true})).toHaveValue("Venue Apex");
  await expect(sandbox.getByLabel("Grid 2 driver name",{exact:true})).toHaveValue("Venue Crew");
  await sandbox.getByRole("button",{name:"Advance one lap",exact:true}).click();
  await expect(sandbox.getByTestId("sandbox-clock")).toHaveText("00:01:30");
  await studio.getByRole("button",{name:"Circuit editor",exact:true}).click();
  await expect(studio.getByLabel("Circuit name",{exact:true})).toHaveValue("Monza 2024 · sandbox");
  await expect(studio.getByRole("alert")).toHaveCount(0);
  await studio.getByRole("button",{name:"Circuit race sandbox",exact:true}).click();
  await sandbox.getByRole("button",{name:"Host this setup with friends",exact:true}).click();
  const room=page.getByRole("dialog",{name:"Multiplayer rooms",exact:true});
  await room.getByLabel("Guest name",{exact:true}).fill("Venue host");
  await room.getByRole("button",{name:"Create private room",exact:true}).click();
  await expect(room.getByRole("status",{exact:true})).toHaveText("Connected");
  await expect(room.getByRole("button",{name:"Claim Venue Apex",exact:true})).toBeVisible();
  await room.getByRole("button",{name:"Close Multiplayer rooms",exact:true}).click();
  await studio.getByRole("button",{name:"Close Custom circuit studio",exact:true}).click();
  await expect(page.getByTestId("elapsed-time")).toContainText("00:02:00");
});

test("saved custom grids keep their setup while roster changes arrive from another tab",async({page,context})=>{
  await page.goto("/?race=monza-2024");
  await page.getByRole("button",{name:"Custom circuit studio",exact:true}).click();
  await page.getByLabel("Circuit name",{exact:true}).fill("Retained custom grid");
  await page.getByRole("button",{name:"Circuit race sandbox",exact:true}).click();
  const sandbox=page.getByRole("region",{name:"Circuit race sandbox",exact:true});
  await sandbox.getByLabel("Grid 1 driver name",{exact:true}).fill("Keep my grid");
  await sandbox.getByRole("button",{name:"Save circuit and race setup",exact:true}).click();
  await sandbox.getByRole("button",{name:"Advance one lap",exact:true}).click();
  const other=await context.newPage();
  try{
    await other.goto("/?race=monza-2024");
    await other.getByRole("button",{name:"Driver recruitment",exact:true}).click();
    await other.getByLabel("Custom driver name",{exact:true}).fill("New signing");
    await other.getByRole("button",{name:"Create and sign custom driver",exact:true}).click();
    await expect(sandbox.getByRole("heading",{name:"Signed team drivers · 1 available",exact:true})).toBeVisible();
    await expect(sandbox.getByLabel("Grid 1 driver name",{exact:true})).toHaveValue("Keep my grid");
    await expect(sandbox.getByTestId("sandbox-clock")).toHaveText("00:01:30");
    await page.reload();
    await page.getByRole("button",{name:"Custom circuit studio",exact:true}).click();
    await page.getByLabel("Saved circuits",{exact:true}).selectOption({label:"Retained custom grid"});
    await page.getByRole("button",{name:"Load circuit",exact:true}).click();
    await page.getByRole("button",{name:"Circuit race sandbox",exact:true}).click();
    await expect(sandbox.getByLabel("Grid 1 driver name",{exact:true})).toHaveValue("Keep my grid");
  }finally{await other.close();}
});
