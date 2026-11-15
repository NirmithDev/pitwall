import { test, expect } from "@playwright/test";
test("playback, lap seeking, driver focus, saving and deleting a moment", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Monza." })).toBeVisible();
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await expect(page.getByTestId("elapsed-time")).not.toContainText("00:00:00");
  await page.getByRole("button", { name: "Pause replay", exact: true }).click();
  await page.getByRole("button", { name: "LAP 20", exact: true }).click();
  await expect(page.getByTestId("current-lap")).toHaveText("20");
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
  await page.goto("/");
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
