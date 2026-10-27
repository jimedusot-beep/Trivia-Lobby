import { test, expect } from "@playwright/test";

test("Tap Dash: existing QR invite controls a native shared-screen race and server score", async ({ browser }) => {
  test.setTimeout(60000);
  const hostContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const playerContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const guest2Context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  try {
    const host = await hostContext.newPage(), player = await playerContext.newPage(), guest2 = await guest2Context.newPage();
    await host.goto("/");
    await host.getByRole("button", { name: "Host Tap Dash, 2–20 players" }).click();
    await expect(host.locator("#heading")).toContainText("lobby");
    const link = await host.locator("#invite-link").inputValue();
    const code = new URL(link).searchParams.get("code");
    for (const [page, name] of [[player, "Tapper One"], [guest2, "Tapper Two"]]) {
      await page.goto(link);
      await page.getByLabel("Nickname", { exact: true }).fill(name);
      await page.getByRole("button", { name: "Join party" }).click();
      await expect(page.locator("#heading")).toContainText("lobby");
    }
    await host.getByRole("button", { name: "Start match" }).click();
    await expect(host.locator(".tap-racer")).toHaveCount(2, { timeout: 12000 });
    const button = player.getByRole("button", { name: "Tap to race" });
    await expect(button).toBeVisible();
    await button.click();
    await expect.poll(async () => Number(await player.locator(".tap-count").innerText()), { timeout: 5000 }).toBeGreaterThan(0);
    await expect(host.locator(".tap-leaderboard")).toContainText("Tapper One");
    expect(await player.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await player.reload();
    await expect(player.getByRole("button", { name: "Tap to race" })).toBeVisible();
    await expect.poll(async () => Number(await player.locator(".tap-count").innerText()), { timeout: 5000 }).toBeGreaterThan(0);
    await expect(host.locator(".tap-results li")).toHaveCount(2, { timeout: 18000 });
    await expect(host.locator("#roster")).toContainText("Tapper One: 100 points");
    await host.getByRole("button", { name: "Next", exact: true }).click();
    await expect(host.locator(".tap-leaderboard")).toBeVisible({ timeout: 8000 });
    host.once("dialog", dialog => dialog.accept());
    await host.getByRole("button", { name: "End this match" }).click();
    await host.getByRole("button", { name: "Return to same party" }).click();
    await expect(host.locator("#heading")).toContainText(code + " · lobby");
    await expect(player.locator("#heading")).toContainText(code + " · lobby");
  } finally {
    await Promise.all([hostContext.close(), playerContext.close(), guest2Context.close()]);
  }
});

test("upstream catalog links only explicitly mapped original Trivia Lobby alternatives", async ({ page }) => {
  await page.goto("/open-party-lab.html");
  await expect(page.locator(".opl-source")).toHaveCount(21);
  await expect(page.locator(".opl-native")).toHaveCount(8);
  await expect(page.locator(".opl-game").filter({ hasText: "Tap Race" }).locator(".opl-native"))
    .toHaveAttribute("href", "./?game=tap");
  await expect(page.locator(".opl-game").filter({ hasText: "Drift Racer" }).locator(".opl-native"))
    .toHaveAttribute("href", "./?game=race");
  await page.locator(".opl-game").filter({ hasText: "Tap Race" }).locator(".opl-native").click();
  await expect(page.locator("#heading")).toContainText("lobby");
  await expect(page.getByLabel("Game mode")).toHaveValue("tap");
});
