import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { mkdir } from "node:fs/promises";
import path from "node:path";
const base = "http://127.0.0.1:4317";

async function lobby(browser, count = 2, viewport = { width: 390, height: 844 }) {
  const contexts = [], errors = [], sent = [];
  async function page(size) {
    const context = await browser.newContext({ viewport: size }); contexts.push(context);
    const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
    return page;
  }
  const host = await page({ width: 1440, height: 1080 });
  await host.goto(base);
  await host.getByRole("button", { name: "Host Party Grand Prix, 2–20 players", exact: true }).click();
  await expect(host.locator("#heading")).toContainText("lobby");
  const png = PNG.sync.read(await host.locator("#party-invitation svg").screenshot());
  const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(qr?.data).toBe(await host.locator("#invite-link").inputValue());
  const players = [];
  for (let i = 0; i < count; i++) {
    const p = await page(viewport), frames = [];
    p.on("websocket", ws => ws.on("framesent", event => { try { frames.push(JSON.parse(event.payload)); } catch {} }));
    sent.push(frames);
    await p.goto(qr.data);
    await p.getByLabel("Nickname", { exact: true }).fill(`Racer ${i + 1}`);
    await p.getByRole("button", { name: "Join party", exact: true }).click();
    await expect(p.locator("#heading")).toContainText("lobby");
    players.push(p);
  }
  return { host, players, sent, errors, code: new URL(qr.data).searchParams.get("code"),
    async start() {
      await host.getByRole("button", { name: "Start match", exact: true }).click();
      await expect(host.locator("#race-track")).toBeVisible({ timeout: 12000 });
      for (const p of players) await expect(p.getByRole("group", { name: "Racing controls" })).toBeVisible();
    },
    async close() { await Promise.all(contexts.map(c => c.close())); } };
}
async function cleanPage(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
}

test("Grand Prix: decoded QR opens a no-login 320px controller; all four controls fit", async ({ browser }) => {
  const f = await lobby(browser, 2, { width: 320, height: 568 });
  try {
    await f.start();
    const p = f.players[0];
    await expect(p.locator("#race-own-number")).toHaveText("#1");
    await expect(p.getByText("Watch your number on the big screen.", { exact: true })).toBeVisible();
    await expect(p.locator("#race-track")).toHaveCount(0);
    await expect(f.host.locator(".race-driver")).toHaveCount(2);
    await expect.poll(async () => Number(await p.locator("#race-own-place").getAttribute("data-speed"))).toBeGreaterThan(0);
    for (const name of ["Steer left", "Steer right", "Hold drift, release for boost", "Use racing item"]) {
      const b = await p.getByRole("button", { name, exact: true }).boundingBox();
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(320);
      expect(b.y + b.height).toBeLessThanOrEqual(568);
    }
    await cleanPage(p); expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test("Grand Prix: independent touch holds, cancel, keyboard release and assistance reach the server", async ({ browser }) => {
  const f = await lobby(browser);
  try {
    await f.start(); const p = f.players[0], frames = f.sent[0];
    const left = p.getByRole("button", { name: "Steer left", exact: true });
    const drift = p.getByRole("button", { name: "Hold drift, release for boost", exact: true });
    await left.dispatchEvent("pointerdown", { pointerId: 41, pointerType: "touch", button: 0, buttons: 1 });
    await drift.dispatchEvent("pointerdown", { pointerId: 42, pointerType: "touch", button: 0, buttons: 1 });
    await expect.poll(() => frames.filter(m => m.type === "race_input").at(-1)?.drift).toBe(true);
    expect(frames.filter(m => m.type === "race_input").at(-1).steer).toBe(-1);
    await left.dispatchEvent("pointerup", { pointerId: 41, pointerType: "touch" });
    await expect.poll(() => frames.filter(m => m.type === "race_input").at(-1)?.steer).toBe(0);
    expect(frames.filter(m => m.type === "race_input").at(-1).drift).toBe(true);
    await drift.dispatchEvent("pointercancel", { pointerId: 42, pointerType: "touch" });
    await expect.poll(() => frames.filter(m => m.type === "race_input").at(-1)?.drift).toBe(false);
    await p.keyboard.down("KeyD"); await p.keyboard.down("Shift");
    await expect.poll(() => frames.filter(m => m.type === "race_input").at(-1)?.steer).toBe(1);
    await p.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect.poll(() => frames.filter(m => m.type === "race_input").at(-1)?.steer).toBe(0);
    await p.keyboard.up("KeyD"); await p.keyboard.up("Shift");
    await p.getByLabel("Steering assistance", { exact: true }).uncheck();
    await expect.poll(async () => p.locator("#race-own-place").getAttribute("data-assist")).toBe("false");
    await p.getByRole("button", { name: "Use racing item", exact: true }).click();
    expect(frames.some(m => m.type === "race_input" && m.item)).toBe(true);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test("Grand Prix: twenty QR controllers and the shared TV recover the same grid after reload", async ({ browser }, testInfo) => {
  test.setTimeout(120000);
  const f = await lobby(browser, 20);
  try {
    await f.start();
    await expect(f.host.locator(".race-driver")).toHaveCount(20);
    await expect(f.players[19].locator("#race-own-number")).toHaveText("#20");
    await f.players[19].reload();
    await expect(f.players[19].locator("#race-own-number")).toHaveText("#20");
    await f.host.reload();
    await expect(f.host.locator("#race-track")).toBeVisible();
    await expect(f.host.locator(".race-driver")).toHaveCount(20);
    await expect(f.host.locator("#heading")).toContainText(f.code);
    for (const p of [f.players[0], f.players[19]]) { await cleanPage(p); await expect(p.locator("#race-own-place")).toContainText("/ 20"); }
    await cleanPage(f.host); expect(f.errors).toEqual([]);
    if (process.env.RACE_SCREENSHOT_DIR && testInfo.project.name === "chromium") {
      await mkdir(process.env.RACE_SCREENSHOT_DIR, { recursive: true });
      await f.host.locator(".race-game").screenshot({ path: path.join(process.env.RACE_SCREENSHOT_DIR, "party-grand-prix-tv.png") });
      await f.players[19].screenshot({ path: path.join(process.env.RACE_SCREENSHOT_DIR, "party-grand-prix-phone.png"), fullPage: true });
    }
  } finally { await f.close(); }
});

test("Grand Prix: heat results, next heat and host end return to the existing same-room games", async ({ browser }) => {
  test.setTimeout(100000);
  const f = await lobby(browser);
  try {
    await f.start();
    await expect(f.host.getByRole("heading", { name: "Heat 1 results", exact: true })).toBeVisible({ timeout: 70000 });
    await expect(f.host.locator(".race-result-list li")).toHaveCount(2);
    await expect(f.players[0].locator("#roster")).toContainText("points");
    await f.host.getByRole("button", { name: "Next", exact: true }).click();
    await expect(f.host.locator(".race-heat")).toHaveText("HEAT 2 / 3", { timeout: 10000 });
    f.host.once("dialog", d => d.accept());
    await f.host.getByRole("button", { name: "End this match", exact: true }).click();
    await expect(f.host.locator("#heading")).toContainText("finished");
    await f.host.getByRole("button", { name: "Return to same party", exact: true }).click();
    await expect(f.host.locator("#heading")).toContainText(`${f.code} · lobby`);
    await f.host.getByLabel("Game mode").selectOption("four");
    await f.host.getByRole("button", { name: "Start match", exact: true }).click();
    await expect(f.host.locator("#heading")).toContainText("playing");
    await expect(f.players[0].locator(".open-game")).toBeVisible();
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
