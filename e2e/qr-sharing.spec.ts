import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { readInvitationQr, readDownloadedQr } from "./helpers/qr";

async function fitsPhone(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const [mode, name] of [["quiz", "Quiz"], ["duel", "Prompt Duel"], ["charades", "Charades"]]) {
  test(`${name} QR invitations join guests and survive active play and host reconnect`, async ({ page, browser, baseURL }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/party/?hostToken=must-not-share#private");
    await page.getByRole("button", { name: "Create host screen", exact: true }).click();
    await expect(page.locator("#heading")).toContainText("lobby");
    const code = (await page.locator("#heading").innerText()).split(" · ")[0];
    const invite = `${baseURL}/party/?code=${code}`;
    expect(await readInvitationQr(page, code)).toBe(invite);
    await expect(page.getByLabel("Direct invitation link", { exact: true })).toHaveValue(invite);
    await page.getByLabel("Game mode", { exact: true }).selectOption(mode);
    await fitsPhone(page);
    if (mode === "quiz") {
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: test.info().outputPath("party-qr-phone.png"), fullPage: true });
      await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { document.documentElement.dataset.copiedInvite = value; } } });
        Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      });
      await page.getByRole("button", { name: "Copy invitation link", exact: true }).click();
      await expect(page.locator(".lobby-invite-notice")).toContainText("Invitation copied");
      expect(await page.locator("html").getAttribute("data-copied-invite")).toBe(invite);
      await page.getByRole("button", { name: "Share game", exact: true }).click();
      await expect(page.locator(".lobby-invite-notice")).toContainText("Invitation copied");
      await page.evaluate(() => {
        Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => { document.documentElement.dataset.sharedInvite = JSON.stringify(data); } });
      });
      await page.getByRole("button", { name: "Share game", exact: true }).click();
      await expect(page.locator(".lobby-invite-notice")).toHaveText("Invitation shared.");
      expect(JSON.parse((await page.locator("html").getAttribute("data-shared-invite"))!).url).toBe(invite);
      await page.evaluate(() => {
        delete document.documentElement.dataset.copiedInvite;
        Object.defineProperty(navigator, "share", { configurable: true, value: async () => { throw new DOMException("Cancelled", "AbortError"); } });
      });
      await page.getByRole("button", { name: "Share game", exact: true }).click();
      expect(await page.locator("html").getAttribute("data-copied-invite")).toBeNull();
      await page.evaluate(() => {
        Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Permission denied"); } } });
      });
      await page.getByRole("button", { name: "Share game", exact: true }).click();
      await expect(page.locator(".lobby-invite-notice")).toContainText("Copy the selected invitation");
      await expect(page.getByLabel("Direct invitation link", { exact: true })).toBeFocused();
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save QR image", exact: true }).click()]);
      expect(download.suggestedFilename()).toBe(`trivia-lobby-${code}.svg`);
      const path = await download.path(); expect(path).toBeTruthy();
      const svg = await readFile(path!, "utf8");
      expect(readDownloadedQr(svg)).toBe(invite); expect(svg).not.toContain("must-not-share");
    }
    const contexts: BrowserContext[] = [];
    try {
      for (let index = 0; index < 3; index++) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); contexts.push(context);
        const player = await context.newPage();
        await player.goto(invite);
        await expect(player.getByLabel("Party code", { exact: true })).toHaveValue(code);
        await expect(player.getByLabel("Email", { exact: true })).toHaveCount(0);
        await player.getByLabel("Nickname", { exact: true }).fill(`QR friend ${index}`);
        if (index === 2) await page.getByLabel("Direct invitation link", { exact: true }).focus();
        await player.getByRole("button", { name: "Join party", exact: true }).click();
        await expect(player.locator("#heading")).toContainText("lobby");
      }
      await expect(page.locator("#roster li")).toHaveCount(3);
      // An incoming player/score update must not replace a focused share control.
      await expect(page.getByLabel("Direct invitation link", { exact: true })).toBeFocused();
      await page.getByRole("button", { name: "Start match", exact: true }).click();
      await expect(page.locator("#heading")).not.toContainText("lobby");
      await expect(page.locator("#party-invitation")).not.toHaveAttribute("open", "");
      await page.getByText("Invite friends · QR & sharing", { exact: true }).click();
      expect(await readInvitationQr(page, code)).toBe(invite);
      await fitsPhone(page);
      await page.reload();
      await expect(page.locator("#status")).toHaveText("Reconnected.");
      await page.getByText("Invite friends · QR & sharing", { exact: true }).click();
      expect(await readInvitationQr(page, code)).toBe(invite);
    } finally { await Promise.all(contexts.map(context => context.close())); }
  });
}

test("QR encoder failure preserves the selectable invitation and game controls", async ({ page }) => {
  await page.route("**/vendor/qrcodegen.js", route => route.fulfill({ contentType: "text/javascript", body:
    'export const qrcodegen = { QrCode: { Ecc: { MEDIUM: 0 }, encodeText() { throw new Error("Encoding unavailable"); } } };' }));
  await page.goto("/party/");
  await page.getByRole("button", { name: "Create host screen", exact: true }).click();
  await expect(page.locator("#heading")).toContainText("lobby");
  await expect(page.getByText("QR code unavailable. Use the invitation link or room code instead.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Direct invitation link", { exact: true })).toHaveValue(/\/party\/\?code=[A-Z2-9]{6}$/);
  await expect(page.getByRole("button", { name: "Save QR image", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Copy invitation link", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Start match", exact: true })).toBeVisible();
});

async function ownerDeck(context: BrowserContext, baseURL: string) {
  const signup = await context.request.post(baseURL + "/api/auth/register", { data: {
    email: `qr-${crypto.randomUUID()}@example.test`, password: "QR-sharing-acceptance-2026",
  } });
  expect(signup.status()).toBe(201);
  const created = await context.request.post(baseURL + "/api/odd-one-out/starter");
  expect(created.status()).toBe(201); return (await created.json()).id as number;
}

test("all eight private host modes share a decodable guest-only QR before and during play", async ({ page, context, browser, baseURL }) => {
  test.setTimeout(90000);
  const deckId = await ownerDeck(context, baseURL!);
  const guestContext = await browser.newContext();
  try {
    await page.goto(`/host/${deckId}`);
    const room = page.getByTestId("room-code"); await expect(room).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/);
    const code = (await room.innerText()).trim(), invite = `${baseURL}/join?code=${code}`;
    for (const mode of ["classic", "teams", "buzzer", "wager", "workshop", "party", "sprint", "odd_one_out"]) {
      await page.getByLabel("Game mode", { exact: true }).selectOption(mode);
      await expect(page.getByLabel("Game mode", { exact: true })).toHaveValue(mode);
      expect(await readInvitationQr(page, code)).toBe(invite);
    }
    await page.getByLabel("Game mode", { exact: true }).selectOption("classic");
    const guest = await guestContext.newPage(); await guest.goto(invite);
    await expect(guest.getByLabel("Room Code", { exact: true })).toHaveValue(code);
    await guest.getByLabel("Your Name", { exact: true }).fill("QR guest");
    await guest.getByRole("button", { name: "Enter Game", exact: true }).click();
    await expect(guest.getByRole("heading", { name: "Joined lobby", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Start Game", exact: true }).click();
    const panel = page.locator(".lobby-invite-panel"); await expect(panel).toBeVisible();
    await panel.locator("summary").click(); expect(await readInvitationQr(page, code)).toBe(invite);
    await page.screenshot({ path: test.info().outputPath("private-host-qr.png"), fullPage: true });
    await page.reload(); await expect(page.locator(".lobby-invite-panel")).toBeVisible();
    await page.locator(".lobby-invite-panel summary").click(); expect(await readInvitationQr(page, code)).toBe(invite);
  } finally {
    await guestContext.close(); await context.request.delete(`/api/decks/${deckId}`);
  }
});

test("assignment QR sharing opens the public quiz without an owner session", async ({ page, context, browser, baseURL }) => {
  const deckId = await ownerDeck(context, baseURL!); let id: string | undefined;
  const guestContext = await browser.newContext();
  try {
    const response = await context.request.post("/api/assignments", { data: { deckId, title: "QR challenge", maxAttempts: 1 } });
    expect(response.status()).toBe(201); id = (await response.json()).id;
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`/assignments/${id}`);
    const invite = `${baseURL}/assignment/${id}`;
    expect(await readInvitationQr(page)).toBe(invite);
    await expect(page.getByLabel("Guest invitation link", { exact: true })).toHaveValue(invite);
    await fitsPhone(page);
    const guest = await guestContext.newPage(); await guest.goto(invite);
    await expect(guest.getByRole("heading", { name: "QR challenge", exact: true })).toBeVisible();
    await expect(guest.getByLabel("Nickname", { exact: true })).toBeVisible();
    await expect(guest.getByLabel("Email", { exact: true })).toHaveCount(0);
  } finally {
    await guestContext.close(); if (id) await context.request.delete(`/api/assignments/${id}`);
    await context.request.delete(`/api/decks/${deckId}`);
  }
});
