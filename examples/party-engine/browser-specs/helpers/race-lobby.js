import { expect } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";
const base = "http://127.0.0.1:4317";

export async function lobby(browser, count = 2, viewport = { width: 390, height: 844 }, setup) {
  const contexts = [], errors = [], sent = [], requests = [];
  async function page(size) {
    const context = await browser.newContext({ viewport: size });
    if (!contexts.length && setup) await context.addInitScript(setup);
    contexts.push(context);
    const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
    const network = []; page.on("request", r => network.push(r.url())); requests.push(network);
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
  return { host, players, sent, errors, requests, code: new URL(qr.data).searchParams.get("code"),
    async start() {
      await host.getByRole("button", { name: "Start match", exact: true }).click();
      await expect(host.locator("#race-track")).toBeVisible({ timeout: 12000 });
      for (const p of players) await expect(p.getByRole("group", { name: "Racing controls" })).toBeVisible();
    },
    async close() {
      try {
        const end = host.getByRole("button", { name: "End this match", exact: true });
        if (await end.isVisible()) {
          host.once("dialog", dialog => dialog.accept());
          await end.click(); await expect(host.locator("#heading")).toContainText("finished");
        }
      } finally { await Promise.all(contexts.map(c => c.close())); }
    } };
}
export async function cleanPage(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
}

