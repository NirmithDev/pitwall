import { test, expect } from "@playwright/test";

test("queued location upgrade preserves time, camera, bookmarks and source selection across reload", async ({ page, request }) => {
  const full = await (await request.get("/api/sessions/monza-2024")).json();
  const timing = { ...full, locations: undefined };
  let completed = false, polls = 0, posts = 0;
  await page.route("**/api/sessions/monza-2024", route => route.fulfill({ json: completed ? full : timing }));
  await page.route("**/api/sessions/monza-2024/bookmarks", route => route.fulfill({ json: [{ id: "fixture", label: "My saved strategy", elapsedSeconds: 12, createdAt: "2026-11-15T00:00:00Z" }] }));
  await page.route("**/api/sessions/monza-2024/locations", route => {
    if (route.request().method() === "POST") {
      posts++;
      return route.fulfill({ status: 202, json: { status: "queued" } });
    }
    completed = ++polls > 1;
    return route.fulfill({ json: { status: completed ? "completed" : "running" } });
  });
  await page.goto("/?race=monza-2024");
  await page.getByRole("button", { name: "LAP 21", exact: true }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: /Saved 1/ }).click();
  const time = await page.getByTestId("elapsed-time").innerText();
  const camera = await page.getByTestId("circuit-map").getAttribute("viewBox");
  await page.getByRole("button", { name: "Load recorded positions", exact: true }).click();
  await expect(page.getByRole("button", { name: "Loading positions…", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Position source", { exact: true })).toHaveValue("recorded", { timeout: 10000 });
  await expect(page.getByTestId("elapsed-time")).toHaveText(time);
  await expect(page.getByTestId("circuit-map")).toHaveAttribute("viewBox", camera!);
  await expect(page.getByText("My saved strategy", { exact: true })).toBeVisible();
  await expect(page.getByTestId("location-status")).toContainText("LEC:");
  await page.reload();
  await expect(page.getByLabel("Position source", { exact: true })).toHaveValue("recorded");
  await expect(page.getByRole("button", { name: "Load recorded positions", exact: true })).toHaveCount(0);
  expect(posts).toBe(1);
});

test("failed location imports keep estimates playable and can retry", async ({ page, request }) => {
  const full = await (await request.get("/api/sessions/monza-2024")).json();
  let completed = false, attempts = 0;
  await page.route("**/api/sessions/monza-2024", route => route.fulfill({ json: completed ? full : { ...full, locations: undefined } }));
  await page.route("**/api/sessions/monza-2024/locations", route => {
    completed = ++attempts > 1;
    return route.fulfill({ json: { status: completed ? "completed" : "failed", error: "No provider coverage. Retry later." } });
  });
  await page.goto("/?race=monza-2024");
  await page.getByRole("button", { name: "Load recorded positions", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("No provider coverage. Retry later.");
  await expect(page.getByLabel("Position source", { exact: true })).toHaveValue("lap");
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await expect(page.getByTestId("elapsed-time")).not.toHaveText("00:00:00");
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  await page.getByRole("button", { name: "Retry recorded positions", exact: true }).click();
  await expect(page.getByLabel("Position source", { exact: true })).toHaveValue("recorded");
});

test("leaving a race while locations load cannot replace the next replay", async ({ page, request }) => {
  const full = await (await request.get("/api/sessions/monza-2024")).json();
  await page.route("**/api/sessions/monza-2024", route => route.fulfill({ json: { ...full, locations: undefined } }));
  await page.route("**/api/sessions/monza-2024/locations", route => route.fulfill({ json: { status: "running" } }));
  await page.goto("/?race=monza-2024");
  await page.getByRole("button", { name: "Load recorded positions", exact: true }).click();
  await expect(page.getByRole("button", { name: "Loading positions…", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Browse races", exact: true }).click();
  await page.getByLabel("Search races", { exact: true }).fill("Interlagos");
  await page.getByRole("button", { name: "Load Interlagos 2026 Race", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Interlagos.", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Loading positions…", exact: true })).toHaveCount(0);
});
