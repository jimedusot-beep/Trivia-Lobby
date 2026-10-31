import { test, expect } from "@playwright/test";

test("solo test lab starts an authoritative quiz with virtual rivals in one tab", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Try Solo Test Mode" })).toHaveAttribute("href", "./solo-test.html");
  await page.goto("/solo-test.html");
  await expect(page.getByRole("heading", { name: "Solo Test Mode" })).toBeVisible();
  await page.locator("#solo-mode").selectOption("quiz");
  await page.getByRole("button", { name: "Start solo test" }).click();
  await expect(page.locator("#solo-room")).toContainText("Temporary test room:", { timeout: 15000 });
  await expect(page.locator("#solo-players li")).toHaveCount(3, { timeout: 15000 });
  await expect(page.locator("#solo-controls button")).toHaveCount(4, { timeout: 15000 });
  await expect(page.locator("#solo-phase")).toContainText("question");
  await page.locator("#solo-controls button").first().click();
  // The two demo rivals usually answer first, so the real reducer can reveal
  // immediately after the user submits; do not expect a persistent lock UI.
  await expect(page.locator("#solo-phase")).toContainText("reveal", { timeout: 10000 });
  await expect(page.getByRole("button", { name: "Next round" })).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/solo-quiz.png", animations: "disabled" });
  await page.getByRole("button", { name: "Stop test" }).click();
  await expect(page.locator("#solo-stage")).toBeHidden();
  await expect(page.getByRole("button", { name: "Start solo test" })).toBeEnabled();
});

test("solo Grand Prix shows real host track and a steerable controller without a new tab", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/solo-test.html");
  await page.getByRole("button", { name: "Start solo test" }).click();
  await expect(page.locator("#solo-players li")).toHaveCount(2, { timeout: 15000 });
  await expect(page.locator(".race-game")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".solo-steering button")).toHaveCount(3, { timeout: 15000 });
  await page.getByRole("button", { name: "← Left" }).click();
  await expect(page.getByRole("button", { name: "← Left" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#solo-room")).toContainText("Temporary test room:");
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/solo-race.png", animations: "disabled" });
  await page.getByRole("button", { name: "Stop test" }).click();
  await expect(page.locator("#solo-stage")).toBeHidden();
});

test("solo Tap Dash offers a one-screen tap controller and simulated competition", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/solo-test.html");
  await page.locator("#solo-mode").selectOption("tap");
  await page.getByRole("button", { name: "Start solo test" }).click();
  await expect(page.locator("#solo-players li")).toHaveCount(2, { timeout: 15000 });
  await expect(page.getByRole("button", { name: "TAP!" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "TAP!" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/solo-tap-mobile.png", animations: "disabled" });
  await page.getByRole("button", { name: "Stop test" }).click();
  await expect(page.locator("#solo-stage")).toBeHidden();
});
