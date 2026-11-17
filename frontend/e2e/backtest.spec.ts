import { test, expect } from "@playwright/test";
test("pace backtests use a valid historical window, export the separation and return to the branch", async ({
  page,
  request,
}) => {
  const race = await (await request.get("/api/sessions/monza-2024")).json();
  await page.goto("/?race=monza-2024&t=1800");
  await page
    .getByRole("button", { name: "Pace forecast backtest", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Find pit-free sample", exact: true })
    .click();
  await expect(dialog.getByTestId("backtest-metrics")).toBeVisible();
  const anchor = Number(
    await dialog
      .getByLabel("Backtest branch lap", { exact: true })
      .inputValue(),
  );
  const downloadPromise = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Export backtest JSON", exact: true })
    .click();
  const stream = await (await downloadPromise).createReadStream(),
    chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.training.every((l: { lap: number }) => l.lap <= anchor)).toBe(
    true,
  );
  expect(exported.rows.every((l: { lap: number }) => l.lap > anchor)).toBe(
    true,
  );
  await dialog
    .getByRole("button", { name: "Open branch in replay", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const lap = race.laps.find(
    (l: { driver: number; lap: number }) => l.driver === 16 && l.lap === anchor,
  );
  expect(
    Number(
      await page
        .getByRole("slider", { name: "Race timeline", exact: true })
        .inputValue(),
    ),
  ).toBeCloseTo(lap.start + lap.duration, 1);
});
test("pace backtest explains invalid windows and fits a mobile light viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/?race=monza-2024");
  await page
    .getByRole("button", { name: "Pace forecast backtest", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Backtest branch lap", { exact: true }).fill("5");
  await expect(dialog.getByRole("alert")).toContainText("five usable");
  await expect(dialog.getByTestId("backtest-metrics")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Find pit-free sample", exact: true })
    .click();
  await expect(dialog.getByTestId("backtest-metrics")).toBeVisible();
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
});
