import { test, expect } from "@playwright/test";

test("driver visibility, labels and defaults can be changed without changing the race", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024");
  const map = page.getByTestId("circuit-map");
  await page.getByRole("button", { name: "Map settings", exact: true }).click();
  await page.getByRole("button", { name: "Hide all", exact: true }).click();
  await expect(map.locator("[data-driver]")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Follow Lando Norris", exact: true })
    .click();
  await expect(map.locator("[data-driver]")).toHaveCount(1);
  await expect(map.locator('[data-driver="4"]')).toBeVisible();
  await page.getByRole("button", { name: "Show all", exact: true }).click();
  await expect(map.locator("[data-driver]")).toHaveCount(20);
  await page.getByLabel("Show VER on map", { exact: true }).uncheck();
  await expect(map.locator('[data-driver="1"]')).toHaveCount(0);
  await page.getByLabel("Driver labels", { exact: true }).selectOption("off");
  await expect(map.locator("[data-driver] text")).toHaveCount(0);
  await page.getByLabel("Driver labels", { exact: true }).selectOption("all");
  await expect(map.locator("[data-driver] text")).toHaveCount(19);
  await page
    .getByRole("button", { name: "Restore defaults", exact: true })
    .click();
  await expect(map.locator("[data-driver]")).toHaveCount(20);
  await expect(page.getByLabel("Driver labels", { exact: true })).toHaveValue(
    "focus",
  );
  await expect(
    page.getByLabel("Background grid", { exact: true }),
  ).toBeChecked();
  await expect(page.getByTestId("current-lap")).toHaveText("1");
});

test("wheel zoom, camera limits and Home reset work through real input events", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024");
  const map = page.getByTestId("circuit-map");
  await expect(map).toBeVisible();
  await map.scrollIntoViewIfNeeded();
  const box = await map.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -120);
  await page.keyboard.up("Control");
  await expect(page.getByLabel("Map zoom", { exact: true })).not.toHaveText(
    "100%",
  );
  const zoomIn = page.getByRole("button", { name: "Zoom in", exact: true });
  for (let i = 0; i < 8 && (await zoomIn.isEnabled()); i++)
    await zoomIn.click();
  await expect(page.getByLabel("Map zoom", { exact: true })).toHaveText("400%");
  await expect(zoomIn).toBeDisabled();
  await map.focus();
  await page.keyboard.press("Home");
  await expect(map).toHaveAttribute("viewBox", "0 0 800 520");
  await expect(
    page.getByRole("button", { name: "Zoom out", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("ArrowLeft");
  await expect(map).toHaveAttribute("viewBox", "0 0 800 520");
  await expect(page.getByTestId("current-lap")).toHaveText("1");
});

test("damaged saved settings and unavailable browser storage do not break replay", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("pitwall.map.v1.monza-2024", "not valid JSON"),
  );
  await page.goto("/?race=monza-2024");
  await expect(page.getByLabel("Map zoom", { exact: true })).toHaveText("100%");
  await expect(
    page.getByTestId("circuit-map").locator("[data-driver]"),
  ).toHaveCount(20);
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Save layout", exact: true }).click();
  await expect(
    page.getByText(
      "This browser could not save the layout. Your current view still works.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Map zoom", { exact: true })).toHaveText("150%");
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await expect(page.getByTestId("elapsed-time")).not.toContainText("00:00:00");
});

test("map camera and driver settings save per race without leaking to another circuit", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024");
  const map = page.getByTestId("circuit-map");
  await expect(page.getByLabel("Map zoom", { exact: true })).toHaveText("100%");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByLabel("Map zoom", { exact: true })).toHaveText("150%");
  const before = await map.getAttribute("viewBox");
  await map.scrollIntoViewIfNeeded();
  const box = await map.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 65,
    box!.y + box!.height / 2 + 25,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(map).not.toHaveAttribute("viewBox", before!);
  await page.getByRole("button", { name: "Map settings", exact: true }).click();
  await page.getByRole("button", { name: "Focus pair", exact: true }).click();
  await expect(map.locator("[data-driver]")).toHaveCount(2);
  await page.getByLabel("Driver labels", { exact: true }).selectOption("all");
  await page.getByLabel("Background grid", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Save layout", exact: true }).click();
  await expect(
    page.getByText("Layout saved in this browser for this race.", {
      exact: true,
    }),
  ).toBeVisible();
  const saved = await map.getAttribute("viewBox");
  await page.reload();
  await expect(page.getByTestId("circuit-map")).toHaveAttribute(
    "viewBox",
    saved!,
  );
  await expect(
    page.getByTestId("circuit-map").locator("[data-driver]"),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Map settings", exact: true }).click();
  await expect(page.getByLabel("Driver labels", { exact: true })).toHaveValue(
    "all",
  );
  await expect(
    page.getByLabel("Background grid", { exact: true }),
  ).not.toBeChecked();
  await page.goto("/?race=session-11412");
  await page.getByLabel("Position source", { exact: true }).selectOption("lap");
  await expect(page.getByLabel("Map zoom", { exact: true })).toHaveText("100%");
  await expect(
    page.getByTestId("circuit-map").locator("[data-driver]"),
  ).toHaveCount(22);
});

test("follow mode works with playback and keyboard camera movement does not seek the race", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024");
  await page.getByRole("button", { name: "LAP 21", exact: true }).click();
  const follow = page.getByRole("button", {
    name: "Follow selected driver",
    exact: true,
  });
  await follow.click();
  await expect(follow).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Map zoom", { exact: true })).toHaveText("200%");
  const before = await page.getByTestId("elapsed-time").innerText();
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await expect(page.getByTestId("elapsed-time")).not.toHaveText(before);
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  const paused = await page.getByTestId("elapsed-time").innerText();
  await page.getByTestId("circuit-map").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(follow).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("elapsed-time")).toHaveText(paused);
  await page.getByRole("button", { name: "Fit circuit", exact: true }).click();
  await expect(page.getByTestId("circuit-map")).toHaveAttribute(
    "viewBox",
    "0 0 800 520",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Map settings", exact: true }).click();
  await expect(
    page.getByLabel("Show LEC on map", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
