import { test, expect } from "@playwright/test";
test("recorded sector crossings use a completed reference, save with the layout and disappear before coverage", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024&t=1800");
  await page.getByRole("button", { name: "Map settings", exact: true }).click();
  await page.getByLabel("Recorded sector markers", { exact: true }).check();
  await expect(page.getByTestId("sector-crossing-1")).toBeVisible();
  await expect(page.getByTestId("sector-crossing-2")).toBeVisible();
  await expect(page.getByTestId("sector-reference")).toContainText(
    "LEC reference lap",
  );
  await page.getByRole("button", { name: "Save layout", exact: true }).click();
  await page.reload();
  await expect(page.getByTestId("sector-crossing-1")).toBeVisible();
  await page
    .getByRole("slider", { name: "Race timeline", exact: true })
    .focus();
  await page.keyboard.press("Home");
  await expect(page.getByTestId("sector-crossing-1")).toHaveCount(0);
  await expect(page.getByTestId("sector-reference")).toContainText(
    "no complete recorded reference",
  );
  await page.getByLabel("Position source", { exact: true }).selectOption("lap");
  await expect(page.getByTestId("sector-reference")).toHaveCount(0);
});
test("sector maps do not invent crossing coordinates during provider gaps", async ({
  page,
  request,
}) => {
  const full = await (await request.get("/api/sessions/monza-2024")).json();
  full.locations.traces = [
    {
      driver: 16,
      samples: [
        [0, 200, 200],
        [1000, 210, 210],
      ],
      rawCount: 2,
      rejected: 0,
      coverage: 0,
      gaps: [],
    },
  ];
  await page.route("**/api/sessions/monza-2024", (route) =>
    route.fulfill({ json: full }),
  );
  await page.goto("/?race=monza-2024&t=1800");
  await page.getByRole("button", { name: "Map settings", exact: true }).click();
  await page.getByLabel("Recorded sector markers", { exact: true }).check();
  await expect(page.getByTestId("sector-crossing-1")).toHaveCount(0);
  await expect(page.getByTestId("sector-reference")).toContainText(
    "no complete recorded reference",
  );
});
