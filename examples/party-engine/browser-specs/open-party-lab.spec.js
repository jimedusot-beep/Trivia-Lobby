import { test, expect } from "@playwright/test";

test("the optional Open Party Lab library links native alternatives without claiming upstream ports", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Browse all 21 Open Party Lab games" })).toBeVisible();
  await page.getByRole("link", { name: "Browse all 21 Open Party Lab games" }).click();
  await expect(page).toHaveURL(/open-party-lab\.html$/);
  await expect(page.getByRole("heading", { name: /Open Party Lab/i, level: 1 })).toBeVisible();
  await expect(page.locator(".opl-game")).toHaveCount(21);
  await expect(page.getByText("Eight entries link to", { exact: false })).toBeVisible();
  await expect(page.locator(".opl-native")).toHaveCount(8);
  await expect(page.locator(".opl-game").filter({hasText: "Drift Racer"})).toContainText("1–4 upstream players");
  await expect(page.locator(".opl-game").filter({hasText: "Imposter"})).toContainText("3–20 upstream players");
  await expect(page.locator(".opl-game button")).toHaveCount(0);
  await expect(page.locator(".opl-source")).toHaveCount(21);
});

test("catalog search, min-capacity filter, and genre are accurate", async ({ page }) => {
  await page.goto("/open-party-lab.html");
  await page.getByLabel("Upstream cap of 10+ players").check();
  await expect(page.locator(".opl-game")).toHaveCount(6);
  await page.getByLabel("Upstream cap of 10+ players").uncheck();
  await page.getByLabel("Game type").selectOption("Racing");
  await expect(page.locator(".opl-game")).toHaveCount(1);
  await expect(page.locator(".opl-game")).toContainText("Drift Racer");
  await page.getByLabel("Game type").selectOption("all");
  await page.getByLabel("Search games").fill("air hockey");
  await expect(page.locator(".opl-game")).toHaveCount(1);
  await expect(page.locator(".opl-game")).toContainText("Air Hockey");
  await page.getByLabel("Search games").fill("no such game exists");
  await expect(page.locator(".opl-game")).toHaveCount(0);
  await expect(page.locator("#opl-count")).toContainText("0 of 21");
});

test("local launcher refuses a public website and can navigate to a user-specified loopback host", async ({ page }) => {
  await page.goto("/open-party-lab.html");
  await page.getByLabel("Open Party Lab host address").fill("https://example.com");
  await page.getByRole("button", { name: "Open local game host" }).click();
  await expect(page).toHaveURL(/open-party-lab\.html$/);
  await expect(page.locator("#opl-host-feedback")).toContainText("Public and credential-bearing URLs are not accepted");
  await page.getByLabel("Open Party Lab host address").fill("http://127.0.0.1:4317/");
  await page.getByRole("button", { name: "Open local game host" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:4317/");
});

test("the 21-game collection stays within a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/open-party-lab.html");
  await expect(page.locator(".opl-game")).toHaveCount(21);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
