import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { lobby, cleanPage } from "./helpers/race-lobby.js";

test("Grand Prix: decoded QR opens a no-login 320px controller; all four controls fit", async ({ browser }) => {
  const f = await lobby(browser, 2, { width: 320, height: 568 });
  try {
    await f.start();
    const p = f.players[0];
    await expect(p.locator("#race-own-number")).toHaveText("#1");
    await p.getByRole("button",{name:"Game info",exact:true}).click();
    await expect(p.getByText("Watch your number on the big screen.", { exact: true })).toBeVisible();
    await p.getByRole("button",{name:"Back to game",exact:true}).click();
    await expect(p.locator("#race-track")).toHaveCount(0);
    await expect(f.host.locator(".race-driver")).toHaveCount(2);
    await expect.poll(async () => Number(await p.locator("#race-own-place").getAttribute("data-speed"))).toBeGreaterThan(0);
    for (const name of ["Steer left", "Steer right", "Hold drift, release for boost", "Use racing item"]) {
      const b = await p.getByRole("button", { name, exact: true }).boundingBox();
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(320);
      expect(b.y + b.height).toBeLessThanOrEqual(568);
    }
    await cleanPage(p);
    await p.setViewportSize({ width: 844, height: 390 });
    for (const [name, half] of [["Steer left", "left"], ["Steer right", "left"], ["Hold drift, release for boost", "right"], ["Use racing item", "right"]]) {
      const box = await p.getByRole("button", { name, exact: true }).boundingBox();
      expect(box.y + box.height).toBeLessThanOrEqual(390);
      if (half === "left") expect(box.x + box.width / 2).toBeLessThan(422);
      else expect(box.x + box.width / 2).toBeGreaterThan(422);
    }
    if (process.env.RACE_SCREENSHOT_DIR && test.info().project.name === "chromium") {
      await mkdir(process.env.RACE_SCREENSHOT_DIR, { recursive: true });
      await p.screenshot({ path: path.join(process.env.RACE_SCREENSHOT_DIR, "party-grand-prix-phone-landscape.png"), fullPage: true });
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
    await p.getByRole("button",{name:"Options",exact:true}).click();
    await p.getByLabel("Steering assistance", { exact: true }).uncheck();
    await p.getByRole("button",{name:"Back to game",exact:true}).click();
    await expect.poll(async () => p.locator("#race-own-place").getAttribute("data-assist")).toBe("false");
    await p.reload();
    await p.getByRole("button",{name:"Options",exact:true}).click();
    await expect(p.getByLabel("Steering assistance",{exact:true})).not.toBeChecked();
    await p.getByRole("button",{name:"Back to game",exact:true}).click();
    await p.getByRole("button", { name: "Use racing item", exact: true }).click();
    await expect.poll(() => frames.some(m => m.type === "race_input" && m.item)).toBe(true);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test("Grand Prix: twenty QR controllers and the shared TV recover the same grid after reload", async ({ browser }, testInfo) => {
  test.setTimeout(120000);
  const f = await lobby(browser, 20);
  try {
    await f.start();
    await expect(f.host.locator(".race-driver")).toHaveCount(20);
    const matchId=f.latest(f.host).matchId;
    if (testInfo.project.name === "chromium") {
      await expect(f.host.locator("#race-track")).toHaveAttribute("data-renderer", "3d", {timeout:15000});
      await expect(f.host.locator("#race-track")).toHaveAttribute("data-karts", "20");
      expect(Number(await f.host.locator("#race-track").getAttribute("data-draw-calls"))).toBeLessThan(700);
    }
    await expect(f.players[19].locator("#race-own-number")).toHaveText("#20");
    f.forget(f.players[19]);
    await f.players[19].reload();
    await expect(f.players[19].locator(".phone-identity")).toHaveText("Racer 20");
    await expect.poll(()=>f.latest(f.players[19])?.matchId).toBe(matchId);
    f.forget(f.host);
    await f.host.reload();
    await expect.poll(()=>{
      const s=f.latest(f.host);
      return s?{matchId:s.matchId,index:s.index,players:s.players.length,phase:["playing","reveal"].includes(s.phase)}:null;
    }).toEqual({matchId,index:0,players:20,phase:true});
    // A slow browser can finish this real heat while reloading. Recovery must
    // render the current server phase, including all twenty published results.
    await expect.poll(()=>f.host.evaluate(()=>{
      const phase=document.body.dataset.partyPhase;
      return phase==="playing" ? document.querySelectorAll(".race-driver").length===20 && !!document.querySelector("#race-track") :
        phase==="reveal" && document.querySelectorAll(".race-result-list li").length===20;
    })).toBe(true);
    if (testInfo.project.name === "chromium") {
      await expect.poll(()=>f.host.evaluate(()=>{
        if(document.body.dataset.partyPhase==="reveal")return document.querySelectorAll(".race-result-list li").length===20;
        const track=document.querySelector("#race-track");
        return track?.dataset.renderer==="3d" && track.dataset.karts==="20" && Number(track.dataset.drawCalls)<700;
      }),{timeout:15000}).toBe(true);
    }
    await expect(f.host.locator("#heading")).toContainText(f.code);
    for (const [p,name] of [[f.players[0],"Racer 1"],[f.players[19],"Racer 20"]]) { await cleanPage(p); await expect(p.locator(".phone-identity")).toHaveText(name); await expect.poll(()=>f.latest(p)?.matchId).toBe(matchId); }
    await cleanPage(f.host); expect(f.errors).toEqual([]);
    if (process.env.RACE_SCREENSHOT_DIR && testInfo.project.name === "chromium") {
      await mkdir(process.env.RACE_SCREENSHOT_DIR, { recursive: true });
      await f.host.locator("#content").screenshot({ path: path.join(process.env.RACE_SCREENSHOT_DIR, "party-grand-prix-tv.png") });
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
    await expect(f.players[0].locator(".phone-surface")).toBeVisible();
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
