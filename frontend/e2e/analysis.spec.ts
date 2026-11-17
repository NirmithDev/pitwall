import { test, expect } from "@playwright/test";
test("failed refresh keeps cached analysis usable and retry updates it without seeking", async ({
  page,
  request,
}) => {
  const full = await (await request.get("/api/sessions/monza-2024")).json();
  let changed = false,
    attempts = 0;
  await page.route("**/api/sessions/monza-2024", (route) =>
    route.fulfill({
      json: changed
        ? {
            ...full,
            analysis: { ...full.analysis, importedAt: "2026-11-17T00:00:00Z" },
          }
        : full,
    }),
  );
  await page.route(
    "**/api/sessions/monza-2024/analysis?refresh=true",
    (route) => {
      changed = ++attempts > 1;
      return route.fulfill({
        json: {
          status: changed ? "completed" : "failed",
          error: "Refresh is temporarily unavailable.",
        },
      });
    },
  );
  await page.goto("/?race=monza-2024&t=1800");
  const clock = await page.getByTestId("elapsed-time").innerText();
  await page
    .getByRole("button", { name: "Race analysis desk", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Refresh measured analysis", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Refresh is temporarily unavailable",
  );
  await expect(
    dialog.getByRole("img", {
      name: "Recorded lap times and trailing five-lap medians for the selected drivers",
    }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Retry measured analysis", exact: true })
    .click();
  await expect(dialog.locator("time")).toHaveAttribute(
    "datetime",
    "2026-11-17T00:00:00Z",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("elapsed-time")).toHaveText(clock);
});
test("measured analysis shows sectors, pit-lane visits and returns to the selected replay lap", async ({
  page,
  request,
}) => {
  const race = await (await request.get("/api/sessions/monza-2024")).json();
  await page.goto("/?race=monza-2024&t=1800");
  await page
    .getByRole("button", { name: "Race analysis desk", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Race analysis desk",
    exact: true,
  });
  await expect(dialog.getByTestId("analysis-source")).toContainText(
    "Measured sectors cached",
  );
  await dialog
    .getByRole("button", { name: "Sector comparison", exact: true })
    .click();
  await dialog
    .getByLabel("Sector comparison lap", { exact: true })
    .selectOption("21");
  await expect(
    dialog.getByRole("region", {
      name: "Measured sector comparison",
      exact: true,
    }),
  ).toContainText("SECTOR 1");
  await dialog
    .getByRole("button", { name: "Pit-lane timing", exact: true })
    .click();
  await expect(
    dialog.getByRole("region", {
      name: "Measured pit-lane timing",
      exact: true,
    }),
  ).toContainText("Neither equals the net race-time loss");
  await dialog
    .getByText("Per-lap data and replay jumps", { exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Replay lap 21 for LEC", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(
    Number(
      await page
        .getByRole("slider", { name: "Race timeline", exact: true })
        .inputValue(),
    ),
  ).toBeCloseTo(
    race.laps.find(
      (l: { driver: number; lap: number }) => l.driver === 16 && l.lap === 21,
    ).start,
    1,
  );
});

test("analysis scope excludes future laps, and CSV export keeps missing values empty", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024&t=120");
  await page
    .getByRole("button", { name: "Race analysis desk", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Analysis scope", { exact: true })
    .selectOption("replay");
  await expect(
    dialog.getByText(
      "No completed laps in this scope. Try the full race or seek later.",
      { exact: true },
    ),
  ).toBeVisible();
  await dialog
    .getByLabel("Analysis scope", { exact: true })
    .selectOption("full");
  await expect(
    dialog.getByRole("img", {
      name: "Recorded lap times and trailing five-lap medians for the selected drivers",
    }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Export driver laps CSV", exact: true })
    .click();
  const download = await downloadPromise,
    stream = await download.createReadStream(),
    chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString();
  expect(csv).toContain("sector_1,sector_2,sector_3");
  expect(csv).toContain('"LEC"');
  expect(csv).not.toContain("null");
});

test("analysis enrichment queues and preserves the existing recorded replay clock", async ({
  page,
  request,
}) => {
  const full = await (await request.get("/api/sessions/monza-2024")).json();
  let loaded = false,
    posts = 0;
  await page.route("**/api/sessions/monza-2024", (route) =>
    route.fulfill({ json: loaded ? full : { ...full, analysis: undefined } }),
  );
  await page.route("**/api/sessions/monza-2024/analysis", (route) => {
    if (route.request().method() === "POST") {
      posts++;
      return route.fulfill({ json: { status: "queued" } });
    }
    loaded = true;
    return route.fulfill({ json: { status: "completed" } });
  });
  await page.goto("/?race=monza-2024&t=1800");
  const time = await page.getByTestId("elapsed-time").innerText();
  await page
    .getByRole("button", { name: "Race analysis desk", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Load measured analysis", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Loading analysis…", exact: true }),
  ).toBeDisabled();
  await expect(page.getByTestId("analysis-source")).toContainText(
    "Measured sectors cached",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("elapsed-time")).toHaveText(time);
  await expect(page.getByLabel("Position source", { exact: true })).toHaveValue(
    "recorded",
  );
  expect(posts).toBe(1);
});

test("analysis failures permit retry and the desk fits a mobile light viewport", async ({
  page,
  request,
}) => {
  const full = await (await request.get("/api/sessions/monza-2024")).json();
  let loaded = false,
    attempts = 0;
  await page.route("**/api/sessions/monza-2024", (route) =>
    route.fulfill({ json: loaded ? full : { ...full, analysis: undefined } }),
  );
  await page.route("**/api/sessions/monza-2024/analysis", (route) => {
    loaded = ++attempts > 1;
    return route.fulfill({
      json: {
        status: loaded ? "completed" : "failed",
        error: "Measured sectors are temporarily unavailable.",
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/?race=monza-2024");
  await page
    .getByRole("button", { name: "Race analysis desk", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Load measured analysis", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await dialog
    .getByRole("button", { name: "Retry measured analysis", exact: true })
    .click();
  await expect(page.getByTestId("analysis-source")).toContainText(
    "Measured sectors cached",
  );
  await dialog
    .getByRole("button", { name: "Sector comparison", exact: true })
    .click();
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
});
