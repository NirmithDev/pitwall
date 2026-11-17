import { test, expect } from "@playwright/test";
test("studio code loads on demand and a failed download leaves the replay recoverable", async ({
  page,
}) => {
  let requested = false;
  await page.route("**/assets/TrackEditor-*.js", (route) => {
    requested = true;
    return route.abort();
  });
  await page.goto("/?race=monza-2024");
  await expect(page.getByTestId("circuit-map")).toBeVisible();
  expect(requested).toBe(false);
  await page
    .getByRole("button", { name: "Custom circuit studio", exact: true })
    .click();
  const error = page.getByRole("dialog", {
    name: "Replay tool unavailable",
    exact: true,
  });
  await expect(error).toBeVisible();
  expect(requested).toBe(true);
  await error
    .getByRole("button", { name: "Return to replay", exact: true })
    .click();
  await expect(error).toHaveCount(0);
  await page.getByRole("button", { name: "Play replay", exact: true }).click();
  await expect(page.getByTestId("elapsed-time")).not.toContainText(
    "00:00:00 /",
  );
});
