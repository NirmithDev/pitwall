import { test, expect } from "@playwright/test";

test("theme choice overrides the system and persists through reload and race changes", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/?race=monza-2024");
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Switch to light mode", exact: true })
    .click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".topbar")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(root).toHaveCSS("color-scheme", "light");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Browse races", exact: true }).click();
  await page.getByLabel("Season", { exact: true }).selectOption("2026");
  await page.getByLabel("Search races", { exact: true }).fill("Interlagos");
  await page
    .getByRole("button", { name: "Load Interlagos 2026 Race", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Interlagos.", exact: true }),
  ).toBeVisible();
  await expect(root).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("button", { name: "Switch to dark mode", exact: true })
    .click();
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveCSS("color-scheme", "dark");
});

test("system light preference and mobile switching keep replay and dialogs usable", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?race=monza-2024");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("button", { name: "Switch to dark mode", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Browse races", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pick your race.", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCSS(
    "background-color",
    "rgb(248, 251, 255)",
  );
  await page
    .getByRole("button", { name: "Close race library", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Switch to dark mode", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
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

test("theme switching still works when browser preference storage is blocked", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    Storage.prototype.getItem = function () {
      throw new DOMException("Blocked", "SecurityError");
    };
    Storage.prototype.setItem = function () {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  await page.goto("/?race=monza-2024");
  await page
    .getByRole("button", { name: "Switch to light mode", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await expect(page.getByTestId("elapsed-time")).not.toContainText("00:00:00");
});
