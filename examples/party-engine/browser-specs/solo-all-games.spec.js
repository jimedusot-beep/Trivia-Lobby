import { test, expect } from "@playwright/test";

test("one-tab Solo Test offers every existing server game without hardcoded duplicates", async ({ page }) => {
  await page.goto("/solo-test.html");
  const catalog = await page.evaluate(async () => (await import("/game-catalog.js")).guestGames.map(g => g.id));
  expect(catalog).toHaveLength(31);
  expect(await page.locator("#solo-mode option").evaluateAll(nodes => nodes.map(n => n.value))).toEqual(catalog);
  await expect(page.locator("#solo-mode")).toHaveValue("race");
  await page.locator("#solo-mode").selectOption("four");
  await expect(page.locator("#solo-seats option")).toHaveCount(4);
  await expect(page.locator("#solo-description")).toContainText("Switch test seats");
});

test("only explicit same-origin test seats may be embedded in browser frames", async ({ request }) => {
  const normal = await request.get("/");
  expect(normal.ok()).toBe(true);
  expect(normal.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  const seat = await request.get("/?solo-seat=solo-abcdef12345678-host");
  expect(seat.ok()).toBe(true);
  expect(seat.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
  const invalid = await request.get("/?solo-seat=untrusted");
  expect(invalid.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  const asset = await request.get("/style.css?solo-seat=solo-abcdef12345678-host");
  expect(asset.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("manual test seats run a real Four in a Row host and two guest controllers without opening tabs", async ({ page, context }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/solo-test.html");
  await page.locator("#solo-mode").selectOption("four");
  await page.locator("#solo-seats").selectOption("2");
  await page.locator("#solo-start").click();
  await expect(page.locator("#solo-all-stage")).toBeVisible();
  await expect(page.locator("#solo-all-room")).toContainText("Four in a Row", { timeout: 25000 });
  await expect(page.locator("#solo-all-seat-switch option")).toHaveCount(2, { timeout: 45000 });
  await expect(page.locator("#solo-status")).toContainText("is running with 2", { timeout: 30000 });
  const host = page.frameLocator("#solo-all-host-frame");
  const seat1 = page.frameLocator("#solo-all-seat-frame-0");
  const seat2 = page.frameLocator("#solo-all-seat-frame-1");
  await expect(host.locator("#game")).toBeVisible();
  await expect(seat1.locator("#game")).toBeVisible();
  await expect(seat1.locator(".open-game")).toBeVisible({timeout:18000});
  // No popup or second top-level page is used for the guest seats.
  expect(context.pages()).toHaveLength(1);
  await page.locator("#solo-all-seat-switch").selectOption("1");
  await expect(page.locator("#solo-all-seat-frame-0")).toBeHidden();
  await expect(page.locator("#solo-all-seat-frame-1")).toBeVisible();
  await expect(seat2.locator(".open-game")).toBeVisible();
  expect(errors).toEqual([]);
  await page.locator("#solo-stop").click();
  await expect(page.locator("#solo-all-stage")).toBeHidden();
  await expect(page.locator("#solo-all-seat-frames iframe")).toHaveCount(0);
  await expect(page.locator("#solo-start")).toBeEnabled();
});

for (const [mode, count, expected] of [
  ["duel", 3, "textarea"],
  ["majority", 3, ".social-prompt"],
  ["feud", 2, ".open-game"],
  ["draw", 2, ".open-game"],
  ["colors", 2, ".open-game"],
  ["table", 2, ".open-game"],
]) test("all-game Solo Test loads a real " + mode + " player turn", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/solo-test.html");
  await page.locator("#solo-mode").selectOption(mode);
  await page.locator("#solo-seats").selectOption(String(count));
  await page.locator("#solo-start").click();
  await expect(page.locator("#solo-all-seat-switch option")).toHaveCount(count, { timeout: 55000 });
  await expect(page.locator("#solo-status")).toContainText("is running with " + count, { timeout: 32000 });
  await expect(page.frameLocator("#solo-all-seat-frame-0").locator(expected)).toBeVisible({ timeout: 22000 });
  await page.locator("#solo-stop").click();
  await expect(page.locator("#solo-all-stage")).toBeHidden();
});
