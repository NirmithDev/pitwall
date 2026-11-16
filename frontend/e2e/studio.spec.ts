import { test, expect } from "@playwright/test";

test("custom circuits edit with keyboard, undo, save, reload and export without touching the replay", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024&t=120");
  const replayPath = await page
    .getByTestId("circuit-map")
    .locator("path")
    .nth(1)
    .getAttribute("d");
  await page
    .getByRole("button", { name: "Custom circuit studio", exact: true })
    .click();
  await page.getByLabel("Circuit name", { exact: true }).fill("Resume ring");
  const radius = page.getByLabel("Corner rounding", { exact: true });
  await radius.focus();
  await page.keyboard.press("Home");
  await expect(radius).toHaveValue("0");
  const initialPath = await page
    .getByTestId("custom-track-canvas")
    .locator("path")
    .last()
    .getAttribute("d");
  await page.keyboard.press("End");
  await expect(radius).toHaveValue("80");
  await expect(
    page.getByTestId("custom-track-canvas").locator("path").last(),
  ).not.toHaveAttribute("d", initialPath!);
  const canvas = page.getByTestId("custom-track-canvas");
  const vertex = canvas.locator('[data-vertex="0"]');
  const before = await vertex.getAttribute("transform");
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  await expect(vertex).not.toHaveAttribute("transform", before!);
  await page.getByRole("button", { name: "Undo edit", exact: true }).click();
  await expect(vertex).toHaveAttribute("transform", before!);
  await page.getByRole("button", { name: "Redo edit", exact: true }).click();
  await expect(vertex).not.toHaveAttribute("transform", before!);
  await page.getByRole("button", { name: "Save circuit", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export circuit JSON", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("pitwall-circuit.json");
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.name).toBe("Resume ring");
  expect(exported.version).toBe(1);
  expect(exported.cornerRadius).toBe(80);
  await page.getByRole("button", { name: "Run preview", exact: true }).click();
  const car = page.getByTestId("preview-car").first(),
    cx = await car.getAttribute("cx");
  await expect(car).not.toHaveAttribute("cx", cx!);
  await page.keyboard.press("Escape");
  await expect(
    page.getByTestId("circuit-map").locator("path").nth(1),
  ).toHaveAttribute("d", replayPath!);
  await expect(page.getByTestId("elapsed-time")).toContainText("00:02:00");
  await page.reload();
  await page
    .getByRole("button", { name: "Custom circuit studio", exact: true })
    .click();
  await page
    .getByLabel("Saved circuits", { exact: true })
    .selectOption({ label: "Resume ring" });
  await page.getByRole("button", { name: "Load circuit", exact: true }).click();
  await expect(page.getByLabel("Circuit name", { exact: true })).toHaveValue(
    "Resume ring",
  );
});

test("dragging invalid geometry blocks saving and undo recovers; imports validate before replacing the draft", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024");
  await page
    .getByRole("button", { name: "Custom circuit studio", exact: true })
    .click();
  const canvas = page.getByTestId("custom-track-canvas"),
    box = await canvas.boundingBox();
  const vertex = canvas.locator('[data-vertex="0"]');
  const v = await vertex.locator("circle").boundingBox();
  await page.mouse.move(v!.x + v!.width / 2, v!.y + v!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + (360 / 800) * box!.width,
    box!.y + (85 / 520) * box!.height,
  );
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "Save circuit", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Undo edit", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save circuit", exact: true }),
  ).toBeEnabled();
  const name = await page
    .getByLabel("Circuit name", { exact: true })
    .inputValue();
  await page.getByLabel("Import circuit JSON", { exact: true }).setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":900}'),
  });
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Import rejected",
  );
  await expect(page.getByLabel("Circuit name", { exact: true })).toHaveValue(
    name,
  );
  const valid = {
    version: 1,
    id: "imported",
    name: "Imported ring",
    points: [
      [160, 130],
      [360, 85],
      [610, 100],
      [690, 220],
      [570, 260],
      [650, 390],
      [420, 430],
      [310, 330],
      [130, 390],
      [85, 240],
    ],
    sectorEnds: [3, 6],
  };
  await page.getByLabel("Import circuit JSON", { exact: true }).setInputFiles({
    name: "circuit.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(valid)),
  });
  await expect(page.getByLabel("Circuit name", { exact: true })).toHaveValue(
    "Imported ring",
  );
  await page.getByRole("button", { name: "Save circuit", exact: true }).click();
  await expect(
    page.getByLabel("Saved circuits", { exact: true }).locator("option"),
  ).toHaveCount(2);
});

test("strategy plans respond to assumptions, save/load, export and preserve replay state", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024&t=120");
  await page
    .getByRole("button", { name: "Strategy what-if lab", exact: true })
    .click();
  await expect(page.getByTestId("pace-calibration")).toContainText(
    "through lap 10",
  );
  const result = page.getByTestId("strategy-result"),
    before = await result.innerText();
  const pitLoss = page.getByLabel("Plan B Pit loss (seconds)", { exact: true });
  await pitLoss.fill("");
  await pitLoss.pressSequentially("22");
  await expect(pitLoss).toHaveValue("22");
  await page
    .getByLabel("Plan B Fresh tyre gain (s/lap)", { exact: true })
    .fill("3");
  await expect(result).not.toHaveText(before);
  await page.getByLabel("Scenario name", { exact: true }).fill("Bold stop");
  await page
    .getByRole("button", { name: "Save scenario", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export comparison JSON", exact: true })
    .click();
  const download = await downloadPromise;
  const stream = await download.createReadStream(),
    chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.raceId).toBe("monza-2024");
  expect(exported.b.freshTyreGain).toBe(3);
  expect(exported.projectionB).toHaveLength(20);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("elapsed-time")).toContainText("00:02:00");
  await page.reload();
  await page
    .getByRole("button", { name: "Strategy what-if lab", exact: true })
    .click();
  await page
    .getByLabel("Saved scenarios", { exact: true })
    .selectOption({ label: "Bold stop" });
  await page
    .getByRole("button", { name: "Load scenario", exact: true })
    .click();
  await expect(
    page.getByLabel("Plan B Fresh tyre gain (s/lap)", { exact: true }),
  ).toHaveValue("3");
  await page.getByLabel("Branch after lap", { exact: true }).fill("3");
  await expect(page.getByRole("alert")).toContainText("Not enough usable laps");
  await expect(result).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save scenario", exact: true }),
  ).toBeDisabled();
});

test("studio and strategy handle blocked browser storage and mobile light theme", async ({
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
  await page.getByRole("button", { name: "Save circuit", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Could not save",
  );
  const studio = page.getByRole("dialog");
  expect((await studio.boundingBox())!.width).toBeLessThan(390);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Strategy what-if lab", exact: true })
    .click();
  await page
    .getByLabel("Scenario name", { exact: true })
    .fill("Blocked scenario");
  await page
    .getByRole("button", { name: "Save scenario", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Could not save",
  );
  expect(
    await page
      .getByRole("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
});
