import { test, expect } from "@playwright/test";
test("fictional drivers use the pit lane, save their setup and export a portable session", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024&t=120");
  await page
    .getByRole("button", { name: "Custom circuit studio", exact: true })
    .click();
  await page.getByLabel("Circuit name", { exact: true }).fill("Apex park");
  await page
    .getByRole("button", { name: "Circuit race sandbox", exact: true })
    .click();
  const sandbox = page.getByRole("region", {
    name: "Circuit race sandbox",
    exact: true,
  });
  await sandbox.getByLabel("Grid 1 driver name", { exact: true }).fill("Apex");
  await sandbox
    .getByRole("button", { name: "Advance one lap", exact: true })
    .click();
  await expect(sandbox.getByTestId("sandbox-clock")).toHaveText("00:01:30");
  await expect(sandbox.getByTestId("sandbox-driver-0")).toHaveAttribute(
    "data-phase",
    /pit|service/,
  );
  await sandbox
    .getByRole("button", { name: "Advance one lap", exact: true })
    .click();
  await expect(sandbox.getByTestId("sandbox-driver-0")).toHaveAttribute(
    "data-phase",
    "track",
  );
  await expect(sandbox.getByText("1 STOP", { exact: true })).toBeVisible();
  await sandbox
    .getByRole("button", { name: "Save circuit and race setup", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await sandbox
    .getByRole("button", { name: "Export sandbox session JSON", exact: true })
    .click();
  const stream = await (await downloadPromise).createReadStream(),
    chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.kind).toBe("pitwall-circuit-sandbox");
  expect(exported.setup.drivers[0].name).toBe("Apex");
  expect(exported.states[0].visited).toBe(true);
  await page
    .getByRole("button", { name: "Circuit editor", exact: true })
    .click();
  await expect(page.getByLabel("Circuit name", { exact: true })).toHaveValue(
    "Apex park",
  );
  await page
    .getByRole("button", { name: "Circuit race sandbox", exact: true })
    .click();
  await expect(
    sandbox.getByLabel("Grid 1 driver name", { exact: true }),
  ).toHaveValue("Apex");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("elapsed-time")).toContainText("00:02:00");
  await page.reload();
  await page
    .getByRole("button", { name: "Custom circuit studio", exact: true })
    .click();
  await page
    .getByLabel("Saved circuits", { exact: true })
    .selectOption({ label: "Apex park" });
  await page.getByRole("button", { name: "Load circuit", exact: true }).click();
  await page
    .getByRole("button", { name: "Circuit race sandbox", exact: true })
    .click();
  await expect(
    sandbox.getByLabel("Grid 1 driver name", { exact: true }),
  ).toHaveValue("Apex");
});
test("pit settings validate, undo recovers and editable pit handles change the route", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024");
  await page
    .getByRole("button", { name: "Custom circuit studio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Circuit race sandbox", exact: true })
    .click();
  const sandbox = page.getByRole("region", {
    name: "Circuit race sandbox",
    exact: true,
  });
  await sandbox.getByLabel("Pit entry percent", { exact: true }).fill("8");
  await expect(sandbox.getByRole("alert")).toContainText(
    "valid pit entry/exit",
  );
  await expect(
    sandbox.getByRole("button", { name: "Run sandbox", exact: true }),
  ).toBeDisabled();
  await sandbox
    .getByRole("button", { name: "Undo sandbox edit", exact: true })
    .click();
  await expect(
    sandbox.getByLabel("Pit entry percent", { exact: true }),
  ).toHaveValue("92");
  await expect(
    sandbox.getByRole("button", { name: "Run sandbox", exact: true }),
  ).toBeEnabled();
  await sandbox
    .getByRole("button", { name: "Edit pit-lane handles", exact: true })
    .click();
  const map = sandbox.getByTestId("sandbox-map"),
    handle = map.locator('[data-pit-control="0"]');
  const before = await handle.getAttribute("transform");
  await map.focus();
  await page.keyboard.press("ArrowRight");
  await expect(handle).not.toHaveAttribute("transform", before!);
  await sandbox
    .getByRole("button", { name: "Undo sandbox edit", exact: true })
    .click();
  await expect(handle).toHaveAttribute("transform", before!);
});
test("the sandbox animates, pauses when returning to editing and retains unsaved driver settings", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024");
  await page
    .getByRole("button", { name: "Custom circuit studio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Circuit race sandbox", exact: true })
    .click();
  const sandbox = page.getByRole("region", {
    name: "Circuit race sandbox",
    exact: true,
  });
  await sandbox
    .getByLabel("Sandbox driver count", { exact: true })
    .selectOption("4");
  await sandbox
    .getByLabel("Grid 4 driver name", { exact: true })
    .fill("Rookie");
  const car = sandbox.getByTestId("sandbox-driver-3"),
    before = await car.getAttribute("transform");
  await sandbox
    .getByRole("button", { name: "Run sandbox", exact: true })
    .click();
  await expect(car).not.toHaveAttribute("transform", before!);
  await page
    .getByRole("button", { name: "Circuit editor", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Circuit race sandbox", exact: true })
    .click();
  await expect(
    sandbox.getByRole("button", { name: "Run sandbox", exact: true }),
  ).toBeVisible();
  await expect(
    sandbox.getByLabel("Grid 4 driver name", { exact: true }),
  ).toHaveValue("Rookie");
});
test("sandbox storage failures and mobile light layout preserve a usable preview", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage denied");
    };
  });
  await page.goto("/?race=monza-2024");
  await page
    .getByRole("button", { name: "Custom circuit studio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Circuit race sandbox", exact: true })
    .click();
  const sandbox = page.getByRole("region", {
    name: "Circuit race sandbox",
    exact: true,
  });
  await sandbox
    .getByRole("button", { name: "Save circuit and race setup", exact: true })
    .click();
  await expect(sandbox.getByRole("status")).toContainText(
    "Could not save race setup",
  );
  await sandbox
    .getByRole("button", { name: "Advance one lap", exact: true })
    .click();
  await expect(sandbox.getByTestId("sandbox-clock")).toHaveText("00:01:30");
  expect(
    await page
      .getByRole("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
});
