import { test, expect } from "@playwright/test";
import { readFile, unlink } from "node:fs/promises";
import { createInteractionEvidence, finishInteractionEvidence } from "./helpers/interaction-evidence.js";

// Controlled diagnostic failures are caught inside these tests. Inspect and
// remove their JSON after successful assertions; ordinary passing game tests
// must never emit a diagnostic. No production input handler is modified.
function controlledInfo(info) {
  return { status: "failed", retry: info.retry, annotations: info.annotations,
    outputPath: name => info.outputPath(name), attach: async () => {} };
}
async function captured(info) {
  await finishInteractionEvidence(info);
  const file = info.outputPath("interaction-diagnostics.json"), text = await readFile(file, "utf8");
  return { file, text, data: JSON.parse(text) };
}
async function enter(page, invite, nickname, keyboard = false) {
  await page.goto(invite); await page.getByLabel("Nickname").fill(nickname);
  const join = page.getByRole("button", { name: "Join party", exact: true });
  if (keyboard) await join.press("Enter"); else await join.click();
  await expect(page.locator("#heading")).toContainText("lobby");
}

test("interaction evidence: native join events without a sent join remain distinguishable", async ({ browser }, testInfo) => {
  const hostContext = await browser.newContext(), guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostContext.newPage(), guest = await guestContext.newPage();
  const info = controlledInfo(testInfo), evidence = createInteractionEvidence(info, "family-join");
  let complete = false;
  try {
    await host.goto("/"); await host.getByRole("button", { name: "Create host screen", exact: true }).click();
    await expect(host.locator("#heading")).toContainText("lobby");
    const invite = await host.locator("#invite-link").inputValue();
    await evidence.observe(guest, "guest-1"); await guest.goto(invite);
    await guest.getByLabel("Nickname").fill("PRIVATE-CAPTURE-WITHHELD");
    await guest.getByLabel("Nickname").press("Space");
    await guest.locator("#join").evaluate(form => form.addEventListener("submit", event => { event.preventDefault(); event.stopImmediatePropagation(); }, { capture: true, once: true }));
    await guest.getByRole("button", { name: "Join party", exact: true }).click();
    await expect(guest.locator("#heading")).toBeEmpty();
    const report = await captured(info), p = report.data.pages[0];
    expect(p.captureUnavailable).toBe(false);
    expect(p.dom.some(e => e.event === "click" && e.target === "join" && e.trusted)).toBe(true);
    expect(p.dom.some(e => e.event === "submit" && e.stage === "capture")).toBe(true);
    expect(p.wire.some(e => e.event === "sent" && e.type === "join")).toBe(false);
    expect(p.dom.some(e => e.key === "space" && e.target === "join")).toBe(false);
    expect(report.text.includes("PRIVATE-CAPTURE-WITHHELD")).toBe(false);
    complete = true; await unlink(report.file);
  } finally {
    await finishInteractionEvidence(info);
    if (!complete) await evidence.stop();
    await Promise.all([hostContext.close(), guestContext.close()]);
  }
});

test("interaction evidence: real join, gas, Next, acknowledgments and reloads are correlated", async ({ browser }, testInfo) => {
  const contexts = [], info = controlledInfo(testInfo), evidence = createInteractionEvidence(info, "wave-gas");
  let complete = false;
  const page = async role => {
    const context = await browser.newContext({ viewport: { width: role === "host" ? 1280 : 390, height: 844 } });
    contexts.push(context); const p = await context.newPage(); await evidence.observe(p, role); return p;
  };
  try {
    const host = await page("host"), guest = await page("guest-1"), other = await page("guest-2"), third = await page("guest-3");
    await host.goto("/"); await host.locator('[data-game="wave"] .pick-game-button').click();
    await expect(host.locator("#heading")).toContainText("lobby");
    const invite = await host.locator("#invite-link").inputValue();
    await enter(guest, invite, "PRIVATE-CAPTURE-POSITIVE", true); await enter(other, invite, "PRIVATE-CAPTURE-OTHER");
    await enter(third, invite, "PRIVATE-CAPTURE-THIRD");
    await host.getByRole("button", { name: "Start match", exact: true }).click();
    await expect(host.locator("#heading")).toContainText("racing");
    await guest.getByRole("button", { name: /GAS: OFF/ }).click();
    await expect(guest.getByRole("button", { name: /GAS: ON/ })).toBeVisible();
    host.once("dialog", d => d.accept()); await host.getByRole("button", { name: "End race and publish results", exact: true }).click();
    await expect(host.locator("#heading")).toContainText("reveal");
    await guest.reload(); await expect(guest.locator("#heading")).toContainText("reveal");
    await host.getByRole("button", { name: "Next", exact: true }).click();
    await expect(guest.locator("#heading")).toContainText("finished");
    const credential = await guest.evaluate(() => JSON.parse(sessionStorage.getItem("party-credential:/")));
    expect(typeof credential?.token).toBe("string");
    const report = await captured(info), h = report.data.pages[0], p = report.data.pages[1];
    expect(report.data.pages.every(item => !item.captureUnavailable)).toBe(true);
    const drive = p.wire.find(e => e.event === "sent" && e.type === "play" && e.action === "drive" && e.gas);
    expect(drive?.request).toBeGreaterThan(0);
    expect(p.wire.some(e => e.type === "ack" && e.request === drive.request)).toBe(true);
    expect(p.wire.some(e => e.event === "received" && e.type === "state" && e.gas)).toBe(true);
    expect(p.dom.some(e => e.event === "click" && e.target === "gas" && e.trusted)).toBe(true);
    expect(p.dom.some(e => e.event === "keydown" && e.key === "enter" && e.target === "join")).toBe(true);
    const next = h.wire.find(e => e.event === "sent" && e.type === "next");
    expect(next?.request).toBeGreaterThan(0);
    expect(h.wire.some(e => e.type === "ack" && e.request === next.request)).toBe(true);
    expect(h.dom.some(e => e.event === "click" && e.target === "host-next" && e.trusted)).toBe(true);
    const press = h.dom.find(e => e.event === "pointerdown" && e.target === "host-next" && e.stage === "capture");
    expect(press.nextWidth).toBeGreaterThan(0); expect(press.nextHeight).toBeGreaterThan(0);
    expect(press.x).toBeGreaterThanOrEqual(press.nextX - 1); expect(press.x).toBeLessThanOrEqual(press.nextX + press.nextWidth + 1);
    expect(Number.isFinite(press.y)).toBe(true); expect(typeof press.timerVisible).toBe("boolean");
    expect(report.data.schemaVersion).toBe(3);
    expect(p.documents).toBe(2);
    expect(p.wire.some(e => e.event === "socket" && e.connection === 2)).toBe(true);
    for (const secret of ["PRIVATE-CAPTURE-POSITIVE", "PRIVATE-CAPTURE-OTHER", "PRIVATE-CAPTURE-THIRD", credential.code, credential.actor, credential.token]) expect(report.text.includes(secret)).toBe(false);
    complete = true; await unlink(report.file);
  } finally {
    await finishInteractionEvidence(info);
    if (!complete) await evidence.stop();
    await Promise.all(contexts.map(context => context.close()));
  }
});

test("interaction evidence: Doodle Next records a private chooser becoming visible without its words", async ({ browser }, testInfo) => {
  const contexts = [], info = controlledInfo(testInfo), evidence = createInteractionEvidence(info, "doodle-next");
  let complete = false;
  const page = async role => {
    const context = await browser.newContext({ viewport: { width: role === "host" ? 1280 : 390, height: 844 } });
    contexts.push(context); const p = await context.newPage(); await evidence.observe(p, role); return p;
  };
  try {
    const host = await page("host"), artist = await page("guest-1"), nextArtist = await page("guest-2"), last = await page("guest-3");
    await host.goto("/"); await host.locator('[data-game="draw"] .pick-game-button').click();
    await expect(host.locator("#heading")).toContainText("lobby");
    const invite = await host.locator("#invite-link").inputValue();
    for (const [p, name] of [[artist, "PRIVATE-DRAW-ARTIST"], [nextArtist, "PRIVATE-DRAW-NEXT"], [last, "PRIVATE-DRAW-LAST"]]) await enter(p, invite, name);
    await host.getByRole("button", { name: "Start match", exact: true }).click();
    const word = await artist.locator(".open-game button").first().innerText();
    await artist.getByRole("button", { name: word, exact: true }).click();
    for (const p of [nextArtist, last]) {
      await p.getByLabel("Guess the drawing").fill(word); await p.getByRole("button", { name: "Submit", exact: true }).click();
    }
    await expect(host.locator("#heading")).toContainText("reveal");
    await host.getByRole("button", { name: "Next", exact: true }).click();
    await expect(nextArtist.getByRole("heading", { name: "Choose your secret word", exact: true })).toBeVisible();
    const report = await captured(info), h = report.data.pages[0], p = report.data.pages[2];
    expect(report.data.pages.every(item => !item.captureUnavailable)).toBe(true);
    expect(h.wire.some(e => e.event === "sent" && e.type === "next")).toBe(true);
    expect(p.wire.some(e => e.type === "state" && e.wordChoicesAvailable)).toBe(true);
    expect(p.dom.some(e => e.wordChooserVisible)).toBe(true);
    for (const secret of [word, "PRIVATE-DRAW-ARTIST", "PRIVATE-DRAW-NEXT", "PRIVATE-DRAW-LAST"]) expect(report.text.includes(secret)).toBe(false);
    complete = true; await unlink(report.file);
  } finally {
    await finishInteractionEvidence(info);
    if (!complete) await evidence.stop();
    await Promise.all(contexts.map(context => context.close()));
  }
});

test("interaction evidence: replaced Next targets retain pointer and keyboard release evidence", async ({ browser }, testInfo) => {
  const contexts = [], info = controlledInfo(testInfo), evidence = createInteractionEvidence(info, "wave-gas");
  let complete = false;
  const page = async role => {
    const context = await browser.newContext({ viewport: { width: role === "host" ? 1280 : 390, height: 844 } });
    contexts.push(context); const p = await context.newPage(); await evidence.observe(p, role); return p;
  };
  try {
    const host = await page("host"), guests = [await page("guest-1"), await page("guest-2"), await page("guest-3")];
    await host.goto("/"); await host.locator('[data-game="wave"] .pick-game-button').click();
    await expect(host.locator("#heading")).toContainText("lobby");
    const invite = await host.locator("#invite-link").inputValue();
    for (const [n, p] of guests.entries()) await enter(p, invite, "PRIVATE-GESTURE-" + n);
    await host.getByRole("button", { name: "Start match", exact: true }).click();
    await expect(host.locator("#heading")).toContainText("racing");
    host.once("dialog", d => d.accept()); await host.getByRole("button", { name: "End race and publish results", exact: true }).click();
    await expect(host.locator("#heading")).toContainText("reveal");
    const next = host.getByRole("button", { name: "Next", exact: true });
    await expect(next).toBeEnabled(); await next.scrollIntoViewIfNeeded();
    const box = await next.boundingBox();
    await host.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await host.mouse.down();
    // Deliberate synthetic target loss. cloneNode does not copy the app's
    // onclick function; no second activation or replacement handler is added.
    await next.evaluate(button => button.replaceWith(button.cloneNode(true)));
    await host.mouse.up();
    await host.locator("#heading").click(); // End any pointer tracking first.
    await next.focus(); await host.keyboard.down("Space");
    await next.evaluate(button => button.remove());
    await host.keyboard.up("Space");
    await host.keyboard.press("Space"); // Unrelated body typing must be ignored.
    await expect(host.locator("#heading")).toContainText("reveal");
    const report = await captured(info), h = report.data.pages[0];
    expect(h.captureUnavailable).toBe(false);
    const down = h.dom.find(e => e.event === "pointerdown" && e.target === "host-next" && e.stage === "capture");
    expect(down?.targetNode).toBeGreaterThan(0);
    expect(h.dom.some(e => e.event === "pointerup" && e.targetNode !== down.targetNode)).toBe(true);
    expect(h.dom.some(e => e.event === "keydown" && e.key === "space" && e.target === "host-next")).toBe(true);
    expect(h.dom.filter(e => e.event === "keyup" && e.key === "space" && e.target === "other")).toHaveLength(2);
    expect(h.wire.some(e => e.event === "sent" && e.type === "next")).toBe(false);
    expect(report.text.includes("PRIVATE-GESTURE-")).toBe(false);
    complete = true; await unlink(report.file);
  } finally {
    await finishInteractionEvidence(info);
    if (!complete) await evidence.stop();
    await Promise.all(contexts.map(context => context.close()));
  }
});
