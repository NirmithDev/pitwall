import { test, expect } from "@playwright/test";
test("playback, lap seeking, driver focus, saving and deleting a moment", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024");
  await expect(page.getByRole("heading", { name: "Monza." })).toBeVisible();
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await expect(page.getByTestId("elapsed-time")).not.toContainText("00:00:00");
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  await page.getByRole("button", { name: "LAP 21", exact: true }).click();
  await expect(page.getByTestId("current-lap")).toHaveText("21");
  await page
    .getByRole("button", { name: "Follow Lando Norris", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Norris", exact: true }),
  ).toBeVisible();
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/bookmarks") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save moment", exact: true }).click();
  const bookmark = await (await created).json();
  await expect(page.getByText(bookmark.label, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Saved/ }).click();
  await expect(page.getByText(bookmark.label, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: `Delete ${bookmark.label}`, exact: true })
    .click();
  await expect(
    page.getByText(bookmark.label, { exact: true }),
  ).not.toBeVisible();
});
test("mobile layout stays within the viewport and data notes are accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?race=monza-2024");
  await expect(page.getByRole("heading", { name: "Monza." })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "About this replay", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "They do not show GPS positions",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("race library filters seasons and opens the latest cached replay", async ({
  page,
}) => {
  await page.goto("/?race=monza-2024");
  await page.getByRole("button", { name: "Browse races", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pick your race." }),
  ).toBeVisible();
  await page.getByLabel("Season", { exact: true }).selectOption("2026");
  await page.getByLabel("Search races", { exact: true }).fill("Interlagos");
  await page
    .getByRole("button", { name: "Load Interlagos 2026 Race", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Interlagos." }),
  ).toBeVisible();
  await expect(page.getByTestId("current-lap")).toHaveText("1");
  await expect(page).toHaveURL(/race=session-11412/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Interlagos." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Browse races", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("uncached race selection queues and polls an import before opening it", async ({
  page,
  request,
}) => {
  const sample = await (
    await request.get("/api/sessions/session-11412")
  ).json();
  const catalog = await (await request.get("/api/sessions")).json();
  catalog.sessions = catalog.sessions.map((session: { id: string }) =>
    session.id === "session-11404" ? { ...session, cached: false } : session,
  );
  await page.route("**/api/sessions", (route) =>
    route.fulfill({ json: catalog }),
  );
  let posts = 0,
    polls = 0;
  await page.route("**/api/sessions/session-11404/import", async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      await route.fulfill({
        json: { sessionId: "session-11404", status: "queued" },
      });
    } else {
      polls++;
      await route.fulfill({
        json: {
          sessionId: "session-11404",
          status: polls === 1 ? "running" : "completed",
        },
      });
    }
  });
  await page.route("**/api/sessions/session-11404", (route) =>
    route.fulfill({
      json: { ...sample, id: "session-11404", circuit: "Mexico City" },
    }),
  );
  await page.route("**/api/sessions/session-11404/bookmarks", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("/?race=monza-2024");
  await page.getByRole("button", { name: "Browse races", exact: true }).click();
  await page.getByLabel("Season", { exact: true }).selectOption("2026");
  await page.getByLabel("Search races", { exact: true }).fill("Mexico");
  await page
    .getByRole("button", { name: "Load Mexico City 2026 Race", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mexico City." }),
  ).toBeVisible();
  expect(posts).toBe(1);
  expect(polls).toBe(2);
});
