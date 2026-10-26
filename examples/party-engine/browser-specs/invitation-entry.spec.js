import { test, expect } from "@playwright/test";

const base = "http://127.0.0.1:4317/";
async function hostRoom(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base);
  await page.getByRole("button", { name: "Create host screen", exact: true }).click();
  await expect(page.locator("#heading")).toContainText("lobby");
  return { context, page, code: (await page.locator("#heading").innerText()).split(" · ")[0] };
}
async function join(page, code, name) {
  await page.goto(`${base}?code=${code}`);
  await page.getByLabel("Nickname", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Join party", exact: true }).click();
  await expect(page.locator("#heading")).toHaveText(`${code} · lobby`);
}

test("invalid invitations show repair guidance and join the corrected room without losing the nickname", async ({ browser }) => {
  const host = await hostRoom(browser);
  const context = await browser.newContext({ viewport: { width: 320, height: 667 } });
  try {
    const page = await context.newPage();
    await page.goto(`${base}?code=${encodeURIComponent('<img src=x onerror=alert(1)>')}`);
    await expect(page.getByLabel("Party code", { exact: true })).toBeFocused();
    await expect(page.locator("#join-error")).toContainText("valid six-character party code");
    await expect(page.locator("#host-entry")).toBeHidden();
    await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
    await page.getByLabel("Nickname", { exact: true }).fill("Fixing my invite");
    await page.getByLabel("Party code", { exact: true }).fill(host.code.toLowerCase());
    await page.getByRole("button", { name: "Join party", exact: true }).click();
    await expect(page.locator("#heading")).toHaveText(`${host.code} · lobby`);
    await expect(page).toHaveURL(`${base}?code=${host.code}`);
    await page.reload();
    await expect(page.locator("#heading")).toHaveText(`${host.code} · lobby`);
    await expect(host.page.locator("#roster")).toContainText("Fixing my invite");
  } finally { await context.close(); await host.context.close(); }
});

test("an expired invitation keeps its error and nickname while the room code is corrected", async ({ browser }) => {
  const host = await hostRoom(browser);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage(), missing = host.code === "ZZZZZZ" ? "YYYYYY" : "ZZZZZZ";
    await page.goto(`${base}?code=${missing}`);
    await page.getByLabel("Nickname", { exact: true }).fill("Still here");
    await page.getByRole("button", { name: "Join party", exact: true }).click();
    await expect(page.locator("#join-error")).toHaveText("Room expired or not found.");
    await expect(page.getByLabel("Nickname", { exact: true })).toHaveValue("Still here");
    await page.getByRole("button", { name: "Change room code", exact: true }).click();
    await expect(page.getByLabel("Party code", { exact: true })).toBeFocused();
    await page.getByLabel("Party code", { exact: true }).fill(host.code);
    await expect(page.locator("#invited-room-code")).toHaveText(host.code);
    await page.getByRole("button", { name: "Join party", exact: true }).click();
    await expect(page.locator("#heading")).toHaveText(`${host.code} · lobby`);
    await expect(page).toHaveURL(`${base}?code=${host.code}`);
  } finally { await context.close(); await host.context.close(); }
});

test("a failed different-room invite preserves the host's return link and selected game", async ({ browser }) => {
  const host = await hostRoom(browser);
  try {
    await host.page.getByLabel("Game mode", { exact: true }).selectOption("caption");
    const missing = host.code === "ZZZZZZ" ? "YYYYYY" : "ZZZZZZ";
    await host.page.goto(`${base}?code=${missing}`);
    await expect(host.page.locator("#other-party")).toContainText(`hosting room ${host.code}`);
    await expect(host.page.locator("#game")).toBeHidden();
    await host.page.getByLabel("Nickname", { exact: true }).fill("New party");
    await host.page.getByRole("button", { name: "Join party", exact: true }).click();
    await expect(host.page.locator("#join-error")).toHaveText("Room expired or not found.");
    await host.page.getByRole("link", { name: `Return to room ${host.code}`, exact: true }).click();
    await expect(host.page.locator("#heading")).toHaveText(`${host.code} · lobby`);
    await expect(host.page.getByLabel("Game mode", { exact: true })).toHaveValue("caption");
  } finally { await host.context.close(); }
});

test("a different QR invite joins the chosen room instead of silently resuming the previous one", async ({ browser }) => {
  const first = await hostRoom(browser), second = await hostRoom(browser);
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await join(page, first.code, "First party name");
    await page.goto(`${base}?code=${second.code}`);
    await expect(page.locator("#other-party")).toContainText(`in room ${first.code}`);
    await page.getByLabel("Nickname", { exact: true }).fill("Second party name");
    await page.getByRole("button", { name: "Join party", exact: true }).click();
    await expect(page.locator("#heading")).toHaveText(`${second.code} · lobby`);
    await expect(second.page.locator("#roster")).toContainText("Second party name");
    await expect(second.page.locator("#roster")).not.toContainText("First party name");
    await page.reload();
    await expect(page.locator("#heading")).toHaveText(`${second.code} · lobby`);
    await expect(page.locator("#roster")).toContainText("Second party name");
  } finally { await context.close(); await first.context.close(); await second.context.close(); }
});
