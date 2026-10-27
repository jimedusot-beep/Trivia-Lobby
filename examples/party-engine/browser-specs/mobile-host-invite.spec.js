import { test, expect } from "@playwright/test";

// A real iPhone host has only one browsing device. The invitation link must
// not reuse that tab's host credential when opened as a guest.
test("phone-only Tap Dash host can inspect a guest invitation in a separate tab", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  try {
    const host = await context.newPage();
    await host.goto("/");
    await host.getByRole("button", { name: "Host Tap Dash, 2–20 players" }).click();
    await expect(host.locator("#heading")).toContainText("lobby");
    await expect(host.getByText("Hosting from one phone?", { exact: false })).toBeVisible();
    await expect(host.getByRole("button", { name: "Start match", exact: true })).toBeDisabled();
    await expect(host.locator("#party-invitation")).toHaveAttribute("open", "");
    const link = host.getByRole("link", { name: "Open guest invitation in new tab" });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    const invite = await host.locator("#invite-link").inputValue();
    expect(new URL(invite).searchParams.has("token")).toBe(false);
    const [guest] = await Promise.all([context.waitForEvent("page"), link.click()]);
    await guest.waitForLoadState("domcontentloaded");
    await expect(guest).toHaveURL(invite);
    await expect(guest.locator("#host-entry")).toBeHidden();
    await expect(guest.getByLabel("Nickname", { exact: true })).toBeVisible();
    await expect(guest.locator("#game")).toBeHidden();
    await guest.getByLabel("Nickname", { exact: true }).fill("One-phone tester");
    await guest.getByRole("button", { name: "Join party", exact: true }).click();
    await expect(guest.locator("#heading")).toContainText("lobby");
    await expect(host.locator("#roster")).toContainText("One-phone tester");
    await expect(host.getByRole("button", { name: "Start match", exact: true })).toBeDisabled();
    const overflow = await host.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  } finally { await context.close(); }
});

test("320px host invitation QR, direct link and share controls fit without sideways scrolling", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 667 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "Create host screen", exact: true }).click();
    await expect(page.locator("#heading")).toContainText("lobby");
    await expect(page.locator(".lobby-invite-qr")).toBeVisible();
    const url = await page.locator("#invite-link").inputValue();
    const code = (await page.locator("#heading").innerText()).split(" · ")[0];
    expect(new URL(url).searchParams.get("code")).toBe(code);
    await expect(page.getByRole("button", { name: "Share game", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy invitation link", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  } finally { await context.close(); }
});
