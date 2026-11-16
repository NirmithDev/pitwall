import { test, expect } from "@playwright/test";

test("driver trails follow the replay clock and stay out of estimate mode", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024");
  await page.getByRole("button", { name: "LAP 21", exact: true }).click();
  await page.getByLabel("Driver trails", { exact: true }).selectOption("30");
  const trail = page.getByTestId("trail-16");
  await expect(trail).toHaveAttribute("d", /L/);
  const path = await trail.getAttribute("d");
  await page.getByRole("button", { name: "Previous lap", exact: true }).click();
  await expect(trail).not.toHaveAttribute("d", path!);
  await page.getByLabel("Position source", { exact: true }).selectOption("lap");
  await expect(trail).toHaveCount(0);
  await expect(
    page.getByLabel("Driver trails", { exact: true }),
  ).toBeDisabled();
});

test("share links restore a paused moment and dialog focus stays contained", async ({
  page,
}) => {
  await page.goto(
    "/?race=monza-2024&t=120.25&driver=4&compare=16&speed=25&source=lap",
  );
  await expect(page.getByTestId("elapsed-time")).toContainText("00:02:00");
  await expect(page.getByLabel("Playback speed", { exact: true })).toHaveValue(
    "25",
  );
  await expect(page.getByTestId("location-status")).toContainText("NOR:");
  await page.getByRole("button", { name: "Share moment", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Share replay moment",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const link = await page
    .getByLabel("Replay link", { exact: true })
    .inputValue();
  expect(new URL(link).searchParams.get("compare")).toBe("16");
  await page.keyboard.press("Tab");
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.goto(link);
  await expect(
    page.getByRole("button", { name: "Play replay", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("elapsed-time")).toContainText("00:02:00");
  await expect(page.getByLabel("Position source", { exact: true })).toHaveValue(
    "lap",
  );
});

test("shared links import an uncached race and apply the requested moment afterwards", async ({
  page,
  request,
}) => {
  const catalog = await (await request.get("/api/sessions")).json();
  catalog.sessions = catalog.sessions.map((s: { id: string }) =>
    s.id === "session-11412" ? { ...s, cached: false } : s,
  );
  await page.route("**/api/sessions", (route) =>
    route.fulfill({ json: catalog }),
  );
  let requested = false;
  await page.route("**/api/sessions/session-11412/import", (route) => {
    requested = true;
    return route.fulfill({ json: { status: "completed" } });
  });
  await page.goto(
    "/?race=session-11412&t=90&driver=16&compare=none&source=lap",
  );
  await expect(
    page.getByRole("heading", { name: "Interlagos.", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("elapsed-time")).toContainText("00:01:30");
  expect(requested).toBe(true);
});

test("named layouts save, load, replace and delete without changing replay time", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024&t=120");
  await page.getByRole("button", { name: "Map settings", exact: true }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Focus pair", exact: true }).click();
  await page.getByLabel("Layout name", { exact: true }).fill("Battle view");
  await page
    .getByRole("button", { name: "Save named layout", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Map settings", exact: true }).click();
  await page
    .getByLabel("Saved layouts", { exact: true })
    .selectOption({ label: "Battle view" });
  await page.getByRole("button", { name: "Load layout", exact: true }).click();
  await expect(page.getByLabel("Map zoom", { exact: true })).toHaveText("150%");
  await expect(
    page.getByTestId("circuit-map").locator("[data-driver]"),
  ).toHaveCount(2);
  await expect(page.getByTestId("elapsed-time")).toContainText("00:02:00");
  await page.getByLabel("Layout name", { exact: true }).fill("Battle view");
  await page
    .getByRole("button", { name: "Save named layout", exact: true })
    .click();
  await expect(
    page.getByLabel("Saved layouts", { exact: true }).locator("option"),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Delete layout", exact: true })
    .click();
  await expect(
    page.getByLabel("Saved layouts", { exact: true }).locator("option"),
  ).toHaveCount(1);
});

test("new replay tools fit a mobile light-theme viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/?race=monza-2024");
  await page.getByRole("button", { name: "Map settings", exact: true }).click();
  await page.getByLabel("Layout name", { exact: true }).fill("Mobile view");
  await page
    .getByRole("button", { name: "Save named layout", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Share moment", exact: true }).click();
  await expect(page.getByLabel("Replay link", { exact: true })).toBeVisible();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
});
