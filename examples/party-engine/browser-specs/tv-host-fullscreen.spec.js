import { test, expect } from "@playwright/test";

test("TV presentation is host-only, preserves QR, and restores its button after exiting", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const host = await context.newPage();
    // Deterministic Fullscreen API simulation tests UI state and Escape-equivalent
    // fullscreenchange; physical display support remains a separate manual gate.
    await host.addInitScript(() => {
      let active = null;
      Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => active });
      Element.prototype.requestFullscreen = async function () {
        active = this;
        document.dispatchEvent(new Event("fullscreenchange"));
      };
      document.exitFullscreen = async () => {
        active = null;
        document.dispatchEvent(new Event("fullscreenchange"));
      };
    });
    await host.goto("/");
    await expect(host.locator("#tv-host-tools")).toBeHidden();
    await host.getByRole("button", { name: "Create host screen", exact: true }).click();
    const button = host.locator("#tv-fullscreen");
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(host.locator(".lobby-invite-qr")).toBeVisible();
    const invite = await host.locator("#invite-link").inputValue();
    const guest = await context.newPage();
    await guest.goto(invite);
    await guest.getByLabel("Nickname", { exact: true }).fill("TV viewer");
    await guest.getByRole("button", { name: "Join party", exact: true }).click();
    await expect(guest.locator("#heading")).toContainText("lobby");
    await expect(guest.locator("#tv-host-tools")).toBeHidden();

    await button.click();
    await expect(button).toHaveText("Exit TV full screen");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    expect(await host.evaluate(() => document.fullscreenElement?.id)).toBe("game");
    await expect(host.locator(".lobby-invite-qr")).toBeVisible();
    await host.evaluate(() => document.exitFullscreen());
    await expect(button).toHaveText("Enter TV full screen");
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(host.locator("#party-invitation")).toHaveAttribute("open", "");
  } finally {
    await context.close();
  }
});

test("host gets an accessible explanation if fullscreen is unsupported", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", { configurable: true, value: undefined });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create host screen", exact: true }).click();
  await page.getByRole("button", { name: "Enter TV full screen", exact: true }).click();
  await expect(page.locator("#tv-fullscreen-status")).toContainText("unavailable");
  await expect(page.locator("#tv-fullscreen")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".lobby-invite-qr")).toBeVisible();
});
