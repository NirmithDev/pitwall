import { test, expect } from "@playwright/test";

test("Monza opens recorded positions and can explicitly switch to lap estimates without seeking", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024");
  const source = page.getByLabel("Position source", { exact: true });
  await expect(source).toHaveValue("recorded");
  await page.getByRole("button", { name: "LAP 21", exact: true }).click();
  const marker = page.getByTestId("circuit-map").locator('[data-driver="16"]');
  await expect(marker).toBeVisible();
  await expect(marker).toHaveAttribute(
    "data-position-source",
    /recorded|smoothed/,
  );
  const recorded = await marker.getAttribute("transform"),
    clock = await page.getByTestId("elapsed-time").innerText();
  await source.selectOption("lap");
  await expect(marker).toHaveAttribute("data-position-source", "estimated");
  await expect(marker).not.toHaveAttribute("transform", recorded!);
  await expect(page.getByTestId("elapsed-time")).toHaveText(clock);
  await source.selectOption("recorded");
  await expect(marker).toHaveAttribute("transform", recorded!);
});

test("a recorded-location dropout hides the marker instead of inventing movement, then resumes on data", async ({
  page,
  request,
}) => {
  const race = await (await request.get("/api/sessions/monza-2024")).json();
  await page.route("**/api/sessions/monza-2024", (route) =>
    route.fulfill({
      json: {
        ...race,
        duration: 12,
        locations: {
          version: 1,
          intervalMs: 1000,
          maxInterpolationGapMs: 2500,
          description: "Deterministic dropout fixture",
          traces: [
            {
              driver: 16,
              samples: [
                [0, 200, 200],
                [1000, 250, 220],
                [11000, 450, 280],
                [12000, 500, 300],
              ],
              coverage: 16.7,
              gaps: [[1000, 11000]],
              rawCount: 4,
              rejected: 0,
            },
          ],
        },
      },
    }),
  );
  await page.goto("/?race=monza-2024");
  const map = page.getByTestId("circuit-map"),
    marker = map.locator('[data-driver="16"]');
  await expect(marker).toBeVisible();
  const timeline = page.getByRole("slider", {
    name: "Race timeline",
    exact: true,
  });
  await timeline.scrollIntoViewIfNeeded();
  const box = await timeline.boundingBox();
  expect(box).not.toBeNull();
  await timeline.click({ position: { x: box!.width / 2, y: box!.height / 2 } });
  await expect(page.getByTestId("location-status")).toHaveText(
    "LEC: location gap",
  );
  await expect(marker).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Follow selected driver", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Position source", { exact: true }).selectOption("lap");
  await expect(marker).toHaveAttribute("data-position-source", "estimated");
  await page
    .getByLabel("Position source", { exact: true })
    .selectOption("recorded");
  await expect(marker).toHaveCount(0);
  await timeline.focus();
  await page.keyboard.press("End");
  await expect(marker).toHaveAttribute("data-position-source", "recorded");
  await expect(marker).toHaveAttribute("transform", /translate\(500,300\)/);
});

test("races without location traces keep estimates labeled and disable recorded mode", async ({
  page,
  request,
}) => {
  const race = await (await request.get("/api/sessions/session-11412")).json();
  delete race.locations;
  await page.route("**/api/sessions/session-11412", route => route.fulfill({ json: race }));
  await page.goto("/?race=session-11412");
  await expect(page.getByLabel("Position source", { exact: true })).toHaveValue(
    "lap",
  );
  await expect(
    page
      .getByLabel("Position source", { exact: true })
      .locator('option[value="recorded"]'),
  ).toBeDisabled();
  await expect(page.getByTestId("location-status")).toContainText(
    "lap estimate",
  );
});
