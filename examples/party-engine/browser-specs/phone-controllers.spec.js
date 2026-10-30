import { test, expect } from "@playwright/test";
import { WebSocket } from "ws";
import { createPartyServer } from "../server.js";
import { guestGames } from "../public/game-catalog.js";
import { mkdir } from "node:fs/promises";
import path from "node:path";

async function preview(page, name) {
  if (!process.env.PHONE_UX_SCREENSHOT_DIR) return;
  await mkdir(process.env.PHONE_UX_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.PHONE_UX_SCREENSHOT_DIR, name) });
}

// Only this fixture can manipulate its own clock. Production exposes no test API.
async function controller(browser, mode, count = 4, viewport = { width: 320, height: 480 }) {
  let now = Date.now();
  const jobs = [],
    sockets = [],
    errors = [];
  const time = {
    clock: () => now,
    setTimer(fn, delay) {
      const job = { fn, due: now + delay };
      jobs.push(job);
      return job;
    },
    clearTimer(job) {
      job.cancelled = true;
    },
    advance(ms) {
      now += ms;
      for (let n = 0; n < 100; n++) {
        const job = jobs.find((job) => !job.cancelled && job.due <= now);
        if (!job) break;
        job.cancelled = true;
        job.fn();
      }
    },
  };
  const app = createPartyServer({
    expectedOrigin: "",
    partyOptions: { clock: time.clock, countdownMs: 1 },
    schedulerOptions: time,
  });
  const context = await browser.newContext({
    viewport,
  });
  const close = async () => {
    await context.close();
    for (const s of sockets) s.terminate();
    await app.close();
  };
  try {
    await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
    const port = app.server.address().port;
    async function peer(message) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`, {
        origin: `http://127.0.0.1:${port}`,
      });
      sockets.push(ws);
      const messages = [];
      const credential = await new Promise((resolve, reject) => {
        ws.on("open", () => ws.send(JSON.stringify(message)));
        ws.on("error", reject);
        ws.on("message", (raw) => {
          const event = JSON.parse(raw);
          messages.push(event);
          if (event.type === "credential") resolve(event);
        });
      });
      return { ws, credential, messages };
    }
    const host = await peer({ type: "create" }),
      code = host.credential.code;
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.controllerActions = [];
      const send = WebSocket.prototype.send;
      WebSocket.prototype.send = function (raw) {
        const message = JSON.parse(raw);
        if (
          ["play", "answer", "write", "vote", "respond", "mark"].includes(
            message.type,
          )
        )
          window.controllerActions.push(message.type);
        return send.call(this, raw);
      };
    });
    await page.goto(`http://127.0.0.1:${port}/?code=${code}`);
    await page.getByLabel("Nickname").fill("Max Nickname WWWWWWWWWWW");
    await page.getByRole("button", { name: "Join party", exact: true }).click();
    await expect(page.locator("body")).toHaveClass(/phone-controller-active/);
    for (let i = 1; i < count; i++)
      await peer({ type: "join", code, name: `Guest ${i + 1}` });
    const party = app.rooms.get(code).party;
    host.ws.send(
      JSON.stringify({
        v: 1,
        type: "start",
        value: mode,
        ...(mode === "charades" ? { category: "actions" } : {}),
        requestId: `controller-start-${mode}`,
        matchId: null,
        revision: party.revision,
      }),
    );
    await expect.poll(() => party.phase).toBe("countdown");
    time.advance(1);
    await expect(page.locator("#heading")).not.toContainText("lobby");
    return { page, app, party, host, time, errors, close };
  } catch (error) {
    await close();
    throw error;
  }
}
async function fits(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const stage = document
          .querySelector(".phone-stage")
          .getBoundingClientRect();
        const failures = [];
        for (const node of document.querySelectorAll(
          ".phone-surface button,.phone-surface input,.phone-surface textarea,.phone-surface select,.phone-surface svg",
        )) {
          if (!node.getClientRects().length) continue;
          const b = node.getBoundingClientRect();
          // Dense game boards retain named squares; ordinary controls use a
          // 44px minimum rather than merely hiding overflow on small screens.
          if (node.matches("button,input,textarea,select") &&
              !node.matches(".board-cell,.board-four > button,.board-mancala > button") &&
              (b.height < 43.9 || b.width < 43.9))
            failures.push({ name: node.textContent.slice(0, 40), touchWidth: b.width, touchHeight: b.height });
          if (
            b.x < stage.x - 1 ||
            b.y < stage.y - 1 ||
            b.right > stage.right + 1 ||
            b.bottom > stage.bottom + 1
          )
            failures.push({
              name:
                node.getAttribute("aria-label") ||
                node.textContent.slice(0, 40),
              top: Math.round(b.y),
              bottom: Math.round(b.bottom),
              stageBottom: Math.round(stage.bottom),
            });
        }
        return failures;
      }),
    )
    .toEqual([]);
  expect(
    await page.evaluate(() => ({
      x: document.documentElement.scrollWidth > innerWidth + 1,
      y: document.documentElement.scrollHeight > innerHeight + 1,
    })),
  ).toEqual({ x: false, y: false });
  await page.evaluate(() => window.scrollTo(0, 500));
  expect(await page.evaluate(() => scrollY)).toBe(0);
  for (const selector of [
    ".phone-hud",
    ".phone-menu",
    ".phone-pager",
    "#status",
  ]) {
    const node = page.locator(selector);
    if (!(await node.isVisible())) continue;
    const box = await node.boundingBox(),
      size = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
  }
}
for (const game of guestGames)
  test(`${game.id}: all controller pages fit portrait and landscape without sending an action`, async ({
    browser,
  }) => {
    // Join on a tall phone first: initial compact grouping used to be the only
    // route tested before every rotation. Exercise the other branch as well.
    const f = await controller(browser, game.id, 4, { width: 390, height: 844 });
    try {
      const p = f.page;
      for (const [width, height] of [
        [320, 480],
        [390, 844],
        [568, 320],
        [844, 390],
      ]) {
        await p.setViewportSize({ width, height });
        await expect(p.locator("#game")).toHaveCSS("height", `${height}px`);
        while (
          await p
            .getByRole("button", {
              name: "← Previous",
              exact: true,
              includeHidden: true,
            })
            .isEnabled()
        )
          await p
            .getByRole("button", { name: "← Previous", exact: true })
            .click();
        for (let group = 0; group < 20; group++) {
          await fits(p);
          if (game.id === "colors" && width === 320 && group === 0)
            await preview(p, "cards-after.png");
          if (game.id === "backgammon" && width === 568 && group === 0)
            await preview(p, "backgammon-after.png");
          const next = p.getByRole("button", {
            name: "Next →",
            exact: true,
            includeHidden: true,
          });
          if (!(await next.isEnabled())) break;
          await next.click();
          if (group === 19) throw Error("Unbounded controller pagination");
        }
      }
      await p.getByRole("button", { name: "Game info", exact: true }).click();
      await expect(p.getByRole("dialog")).toBeVisible();
      expect((await p.locator(".phone-dialog-bar h2").boundingBox()).height).toBeLessThan(90);
      expect(await p.locator(".phone-dialog-body:visible").evaluate(node => node.clientHeight)).toBeGreaterThan(44);
      await p.keyboard.press("Escape");
      await expect(
        p.getByRole("button", { name: "Game info", exact: true }),
      ).toBeFocused();
      await p.getByRole("button", { name: "Scores", exact: true }).click();
      await expect(p.getByRole("dialog")).toContainText(
        "Max Nickname WWWWWWWWWWW",
      );
      await p
        .getByRole("button", { name: "Back to game", exact: true })
        .click();
      expect(await p.evaluate(() => window.controllerActions)).toEqual([]);
      expect(f.errors).toEqual([]);
    } finally {
      await f.close();
    }
  });
test("twenty candidate choices are paged; choosing the last group still submits on the real socket", async ({
  browser,
}) => {
  const f = await controller(browser, "likely", 20);
  try {
    const p = f.page;
    await fits(p);
    let last;
    for (let n = 0; n < 20; n++) {
      last = p.locator(".phone-choices:visible button:enabled").last();
      if (
        !(await p
          .getByRole("button", {
            name: "Next →",
            exact: true,
            includeHidden: true,
          })
          .isEnabled())
      )
        break;
      await p.getByRole("button", { name: "Next →", exact: true }).click();
      await fits(p);
    }
    await last.click();
    await expect(p.locator("#status")).toHaveText("Submission accepted.");
    expect(await p.evaluate(() => window.controllerActions)).toEqual([
      "respond",
    ]);
  } finally {
    await f.close();
  }
});
test("Prompt Duel preserves both drafts and keyboard focus across groups, updates and reload", async ({
  browser,
}) => {
  const f = await controller(browser, "duel");
  try {
    const p = f.page,
      field = p.locator(".phone-surface textarea:visible").first();
    await field.fill("Keep this first draft");
    const id = await field.getAttribute("id");
    await p.getByRole("button", { name: "Next →", exact: true }).click();
    await p
      .locator(".phone-surface textarea:visible")
      .fill("Keep this second draft");
    await p.getByRole("button", { name: "← Previous", exact: true }).click();
    await expect(p.locator(`#${id}`)).toHaveValue("Keep this first draft");
    await p.reload();
    await expect(p.locator(`#${id}`)).toHaveValue("Keep this first draft");
    await p.locator(`#${id}`).focus();
    await p
      .locator(".phone-surface:visible")
      .getByRole("button", { name: "Lock response", exact: true })
      .first()
      .click();
    await expect(p.locator("#status")).toHaveText("Submission accepted.");
  } finally {
    await f.close();
  }
});
test("typing controls fit a reduced visual viewport and restore after the keyboard closes", async ({
  browser,
}) => {
  const f = await controller(browser, "closest");
  try {
    const p = f.page;
    await p.setViewportSize({ width: 390, height: 844 });
    await p.getByLabel("Your closest estimate (whole number)").fill("42");
    await p.evaluate(() => {
      Object.defineProperty(visualViewport, "height", {
        configurable: true,
        get: () => 260,
      });
      visualViewport.dispatchEvent(new Event("resize"));
    });
    await expect(p.locator(".phone-shell")).toHaveAttribute(
      "data-keyboard",
      "true",
    );
    await fits(p);
    const box = await p
      .getByRole("button", { name: "Lock answer", exact: true })
      .boundingBox();
    expect(box.y + box.height).toBeLessThan(260);
    await p.evaluate(() => {
      delete visualViewport.height;
      visualViewport.dispatchEvent(new Event("resize"));
    });
    await expect(p.locator(".phone-shell")).toHaveAttribute(
      "data-keyboard",
      "false",
    );
    await expect(
      p.getByRole("button", { name: "Game info", exact: true }),
    ).toBeVisible();
    await expect(
      p.getByLabel("Your closest estimate (whole number)"),
    ).toHaveValue("42");
  } finally {
    await f.close();
  }
});

// Runs automatically once the separate Homeward feature joins the catalog.
test("tall-first candidate groups remain reachable after rotating to a short phone", async ({ browser }) => {
  const f = await controller(browser, "likely", 20, { width: 390, height: 844 });
  try {
    const p = f.page;
    for (const viewport of [{ width: 320, height: 480 }, { width: 568, height: 320 }]) {
      await p.setViewportSize(viewport);
      await expect(p.locator("#game")).toHaveCSS("height", `${viewport.height}px`);
      while (await p.getByRole("button", { name: "← Previous", exact: true, includeHidden: true }).isEnabled())
        await p.getByRole("button", { name: "← Previous", exact: true }).click();
      for (let n = 0; n < 20; n++) {
        await fits(p);
        const next = p.getByRole("button", { name: "Next →", exact: true, includeHidden: true });
        if (!(await next.isEnabled())) break;
        await next.click();
      }
    }
    await p.locator(".phone-choices:visible button:enabled").last().click();
    await expect(p.locator("#status")).toHaveText("Submission accepted.");
    expect(await p.evaluate(() => window.controllerActions)).toEqual(["respond"]);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test("keyboard panning follows visual viewport scroll without losing the draft or submit", async ({ browser }) => {
  const f = await controller(browser, "closest");
  try {
    const p = f.page;
    await p.setViewportSize({ width: 390, height: 844 });
    await p.getByLabel("Your closest estimate (whole number)").fill("42");
    await p.evaluate(() => {
      Object.defineProperty(visualViewport, "height", { configurable: true, get: () => 260 });
      visualViewport.dispatchEvent(new Event("resize"));
    });
    await expect(p.locator(".phone-shell")).toHaveAttribute("data-keyboard", "true");
    await p.evaluate(() => {
      Object.defineProperty(visualViewport, "offsetTop", { configurable: true, get: () => 130 });
      visualViewport.dispatchEvent(new Event("scroll"));
    });
    await expect(p.locator("#game")).toHaveCSS("top", "130px");
    const submit = p.getByRole("button", { name: "Lock answer", exact: true });
    const box = await submit.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(130);
    expect(box.y + box.height).toBeLessThanOrEqual(390);
    await preview(p, "keyboard-panned.png");
    await p.evaluate(() => {
      delete visualViewport.offsetTop;
      delete visualViewport.height;
      visualViewport.dispatchEvent(new Event("resize"));
    });
    await expect(p.locator("#game")).toHaveCSS("top", "0px");
    await expect(p.getByLabel("Your closest estimate (whole number)")).toHaveValue("42");
    await submit.click();
    await expect(p.locator("#status")).toHaveText("Submission accepted.");
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test("controller dialog keeps keyboard focus and reading position during a room update", async ({ browser }) => {
  const f = await controller(browser, "closest");
  try {
    const p = f.page;
    await p.setViewportSize({ width: 568, height: 320 });
    await p.getByRole("button", { name: "Options", exact: true }).click();
    expect((await p.locator(".phone-dialog-bar h2").boundingBox()).height).toBeLessThan(90);
    expect(await p.locator(".phone-dialog-body:visible").evaluate(node => node.clientHeight)).toBeGreaterThan(44);
    const credits = p.getByRole("link", { name: "Game credits, licenses & source code" });
    await credits.focus();
    await p.locator(".phone-dialog-body:visible").evaluate(node => { node.scrollTop = node.scrollHeight; });
    const scrollTop = await p.locator(".phone-dialog-body:visible").evaluate(node => node.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
    f.host.ws.close();
    await expect(p.locator(".phone-originals")).toContainText("Host disconnected");
    await expect(credits).toBeFocused();
    expect(await p.locator(".phone-dialog-body:visible").evaluate(node => node.scrollTop)).toBe(scrollTop);
    await preview(p, "options-after.png");
    await p.keyboard.press("Escape");
    await expect(p.getByRole("button", { name: "Options", exact: true })).toBeFocused();
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test("short-landscape prompt remains a full-size touch target", async ({ browser }) => {
  const f = await controller(browser, "closest");
  try {
    const p = f.page;
    await p.setViewportSize({ width: 568, height: 320 });
    await expect(p.locator("#game")).toHaveCSS("height", "320px");
    expect((await p.locator(".phone-prompt").boundingBox()).height).toBeGreaterThanOrEqual(44);
    await fits(p);
    await preview(p, "prompt-after.png");
    await p.locator(".phone-prompt").click();
    await expect(p.getByRole("dialog")).toBeVisible();
    expect(await p.evaluate(() => window.controllerActions)).toEqual([]);
  } finally { await f.close(); }
});

test("rotation keeps the focused candidate visible when page capacity changes", async ({ browser }) => {
  const f = await controller(browser, "likely", 20, { width: 844, height: 390 });
  try {
    const p = f.page;
    const choice = p.locator(".phone-choices:visible button:enabled").last();
    const label = await choice.textContent();
    await choice.focus();
    await p.setViewportSize({ width: 320, height: 480 });
    await expect(p.locator("#game")).toHaveCSS("height", "480px");
    const sameChoice = p.locator(".phone-choices button").filter({ hasText: label });
    await expect(sameChoice).toBeVisible();
    await expect(sameChoice).toBeFocused();
    await fits(p);
    expect(await p.evaluate(() => window.controllerActions)).toEqual([]);
    await p.keyboard.press("Enter");
    await expect(p.locator("#status")).toHaveText("Submission accepted.");
    expect(await p.evaluate(() => window.controllerActions)).toEqual(["respond"]);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

for (const mode of ["likely", "impostor"])
test(`${mode}: a room broadcast keeps the focused nomination on its current page`, async ({ browser }) => {
  const f = await controller(browser, mode, 20);
  try {
    const p = f.page;
    if (mode === "impostor") {
      f.time.advance(45001);
      await expect(p.locator("#heading")).toContainText("voting");
    }
    await p.getByRole("button", { name: "Next →", exact: true }).click();
    const choice = p.locator(".phone-choices:visible button:enabled").last();
    const name = await choice.textContent();
    const index = await choice.evaluate(button =>
      [...document.querySelectorAll(".phone-choices button")].indexOf(button));
    const target = f.party.roster[index];
    expect(target).toBeTruthy();
    await choice.focus();
    f.host.ws.close();
    await expect(p.locator(".phone-originals")).toContainText("Host disconnected");
    const restored = p.locator(".phone-choices button").filter({ hasText: name });
    await expect(restored).toBeVisible();
    await expect(restored).toBeFocused();
    expect(await p.evaluate(() => window.controllerActions)).toEqual([]);
    await p.keyboard.press("Enter");
    await expect(p.locator("#status")).toHaveText("Submission accepted.");
    await expect.poll(() => (mode === "impostor" ? f.party.social.votes : f.party.social.responses)
      .get(f.party.roster[0])).toBe(target);
    expect(await p.evaluate(() => window.controllerActions)).toEqual(["respond"]);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test("closing full-prompt help returns to its opener after a room update", async ({ browser }) => {
  const f = await controller(browser, "closest");
  try {
    const p = f.page;
    const prompt = p.locator(".phone-prompt");
    await prompt.focus();
    await p.keyboard.press("Enter");
    await expect(p.getByRole("dialog")).toBeVisible();
    f.host.ws.close();
    await expect(p.locator(".phone-originals")).toContainText("Host disconnected");
    await p.keyboard.press("Escape");
    await expect(prompt).toBeFocused();
    expect(await p.evaluate(() => window.controllerActions)).toEqual([]);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test("rotation preserves the current candidate group while focus stays on the menu", async ({ browser }) => {
  const f = await controller(browser, "likely", 20, { width: 844, height: 390 });
  try {
    const p = f.page;
    await p.getByRole("button", { name: "Next →", exact: true }).click();
    const label = await p.locator(".phone-choices:visible button").first().textContent();
    const menu = p.getByRole("button", { name: "Game info", exact: true });
    await menu.focus();
    for (const viewport of [{ width: 320, height: 480 }, { width: 844, height: 390 }]) {
      await p.setViewportSize(viewport);
      await expect(p.locator("#game")).toHaveCSS("height", `${viewport.height}px`);
      await expect(p.locator(".phone-choices button").filter({ hasText: label })).toBeVisible();
      await expect(menu).toBeFocused();
      await fits(p);
    }
    expect(await p.evaluate(() => window.controllerActions)).toEqual([]);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test("pen tools return to the drawing controller with preferences intact", async ({ browser }) => {
  const f = await controller(browser, "draw");
  try {
    const p = f.page;
    await p.locator(".phone-choices:visible button").first().click();
    const pen = p.getByRole("button", { name: "Pen tools", exact: true });
    await pen.click();
    await p.getByRole("combobox", { name: "Pen color", exact: true }).selectOption("#2477db");
    await p.getByRole("combobox", { name: "Pen width", exact: true }).selectOption("16");
    await p.getByRole("button", { name: "Back to game", exact: true }).click();
    await expect(pen).toBeFocused();
    await p.keyboard.press("Enter");
    await expect(p.getByRole("combobox", { name: "Pen color", exact: true })).toHaveValue("#2477db");
    await expect(p.getByRole("combobox", { name: "Pen width", exact: true })).toHaveValue("16");
    await p.keyboard.press("Escape");
    await expect(pen).toBeFocused();
    await expect(p.locator(".phone-surface .doodle-pad")).toBeVisible();
    expect(await p.evaluate(() => window.controllerActions)).toEqual(["play"]);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test("Prompt Duel keeps both the draft and primary action above a simulated keyboard", async ({ browser }) => {
  const f = await controller(browser, "duel", 4, { width: 390, height: 844 });
  try {
    const p = f.page;
    const field = p.locator(".phone-surface textarea:visible");
    await field.fill("My keyboard-safe draft");
    await p.evaluate(() => {
      Object.defineProperty(visualViewport, "height", { configurable: true, get: () => 260 });
      visualViewport.dispatchEvent(new Event("resize"));
    });
    await expect(p.locator(".phone-shell")).toHaveAttribute("data-keyboard", "true");
    await fits(p);
    const submit = p.getByRole("button", { name: "Lock response", exact: true }).filter({ visible: true });
    const box = await submit.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(260);
    await preview(p, "duel-keyboard.png");
    await p.evaluate(() => {
      delete visualViewport.height;
      visualViewport.dispatchEvent(new Event("resize"));
    });
    await expect(p.locator(".phone-shell")).toHaveAttribute("data-keyboard", "false");
    await expect(field).toHaveValue("My keyboard-safe draft");
    await submit.click();
    await expect(p.locator("#status")).toHaveText("Submission accepted.");
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test("leaving restores the ordinary page and removes viewport tracking", async ({ browser }) => {
  const f = await controller(browser, "closest");
  try {
    const p = f.page;
    await p.getByRole("button", { name: "Options", exact: true }).click();
    p.once("dialog", dialog => dialog.accept());
    await p.getByRole("button", { name: "Leave party", exact: true }).click();
    await expect(p.locator("body")).not.toHaveClass(/phone-controller-active/);
    await expect(p.getByRole("button", { name: "Join party", exact: true })).toBeVisible();
    await p.evaluate(() => visualViewport.dispatchEvent(new Event("scroll")));
    expect(await p.evaluate(() => ["--controller-height", "--controller-top", "--controller-status-height"].map(name => document.documentElement.style.getPropertyValue(name)))).toEqual(["", "", ""]);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test("controller and reference dialog respect browser safe-area insets", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "Safe-area env override uses Chromium's CDP; physical iOS remains a separate check.");
  const f = await controller(browser, "closest", 4, { width: 390, height: 844 });
  try {
    const p = f.page;
    const cdp = await p.context().newCDPSession(p);
    for (const [viewport, insets] of [
      [{ width: 390, height: 844 }, { top: 44, left: 0, right: 0, bottom: 34 }],
      [{ width: 568, height: 320 }, { top: 0, left: 44, right: 44, bottom: 21 }],
    ]) {
      await p.setViewportSize(viewport);
      await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets });
      await p.evaluate(() => window.dispatchEvent(new Event("resize")));
      await expect(p.locator("#status")).toHaveCSS("top", `${insets.top}px`);
      await fits(p);
      await p.getByRole("button", { name: "Options", exact: true }).click();
      await preview(p, insets.top ? "safe-area-portrait.png" : "safe-area-landscape.png");
      for (const selector of [".phone-dialog", ".phone-dialog-bar button"]) {
        const box = await p.locator(selector).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(insets.left);
        expect(box.y).toBeGreaterThanOrEqual(insets.top);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - insets.right);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - insets.bottom);
      }
      await p.getByRole("button", { name: "Back to game", exact: true }).click();
    }
    expect(await p.evaluate(() => window.controllerActions)).toEqual([]);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

for (const mode of ["duel", "closest"])
  test(`${mode}: keyboard controls fit with notch and home-indicator insets`, async ({ browser, browserName }) => {
    test.skip(browserName !== "chromium", "CSS safe-area emulation requires CDP.");
    const f = await controller(browser, mode, 4, { width: 390, height: 844 });
    try {
      const p = f.page;
      const cdp = await p.context().newCDPSession(p);
      await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 47, bottom: 34, left: 0, right: 0 } });
      const field = p.locator(".phone-surface input:visible,.phone-surface textarea:visible").first();
      const draft = mode === "closest" ? "42" : "Keep this notched-phone draft";
      const submit = p.getByRole("button", { name: mode === "closest" ? "Lock answer" : "Lock response", exact: true }).filter({ visible: true });
      for (const scale of [100, 150]) {
        await p.evaluate(scale => document.documentElement.style.setProperty("font-size", `${scale}%`, "important"), scale);
        await expect(p.locator("html")).toHaveCSS("font-size", scale === 150 ? "24px" : "16px");
        await field.fill(draft);
        await p.evaluate(() => {
          Object.defineProperty(visualViewport, "height", { configurable: true, get: () => 260 });
          visualViewport.dispatchEvent(new Event("resize"));
        });
        await expect(p.locator(".phone-shell")).toHaveAttribute("data-keyboard", "true");
        await preview(p, `${mode}-safe-keyboard-${scale}.png`);
        await fits(p);
        const box = await submit.boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(47);
        expect(box.y + box.height).toBeLessThanOrEqual(260 - 34);
      }
      await p.evaluate(() => {
        delete visualViewport.height;
        visualViewport.dispatchEvent(new Event("resize"));
      });
      await expect(p.locator(".phone-shell")).toHaveAttribute("data-keyboard", "false");
      await expect(field).toHaveValue(draft);
      await submit.click();
      await expect(p.locator("#status")).toHaveText("Submission accepted.");
      expect(f.errors).toEqual([]);
    } finally { await f.close(); }
  });

for (const mode of ["colors", "backgammon"])
  test(`${mode}: safe-area controller pages keep ordinary touch targets reachable`, async ({ browser, browserName }) => {
    test.skip(browserName !== "chromium", "CSS safe-area emulation requires CDP.");
    const f = await controller(browser, mode, 4, { width: 390, height: 664 });
    try {
      const p = f.page;
      const cdp = await p.context().newCDPSession(p);
      for (const [viewport, insets] of [
        [{ width: 390, height: 664 }, { top: 47, bottom: 34, left: 0, right: 0 }],
        [{ width: 568, height: 320 }, { top: 0, bottom: 21, left: 44, right: 44 }],
      ]) {
        await p.setViewportSize(viewport);
        await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets });
        await p.evaluate(() => window.dispatchEvent(new Event("resize")));
        await expect(p.locator("#status")).toHaveCSS("top", `${insets.top}px`);
        while (await p.getByRole("button", { name: "← Previous", exact: true, includeHidden: true }).isEnabled())
          await p.getByRole("button", { name: "← Previous", exact: true }).click();
        for (let n = 0; n < 20; n++) {
          await preview(p, `${mode}-safe-${viewport.width}.png`);
          await fits(p);
          const next = p.getByRole("button", { name: "Next →", exact: true, includeHidden: true });
          if (!(await next.isEnabled())) break;
          await next.click();
          if (n === 19) throw Error("Unbounded controller pagination");
        }
      }
      expect(await p.evaluate(() => window.controllerActions)).toEqual([]);
      expect(f.errors).toEqual([]);
    } finally { await f.close(); }
  });

for (const mode of ["quiz", "closest"])
  test(`${mode}: larger text keeps every controller page usable`, async ({ browser }) => {
    const f = await controller(browser, mode);
    try {
      const p = f.page;
      await p.evaluate(() => document.documentElement.style.setProperty("font-size", "150%", "important"));
      await expect(p.locator("html")).toHaveCSS("font-size", "24px");
      for (const viewport of [{ width: 320, height: 480 }, { width: 568, height: 320 }]) {
        await p.setViewportSize(viewport);
        await expect(p.locator("#game")).toHaveCSS("height", `${viewport.height}px`);
        while (await p.getByRole("button", { name: "← Previous", exact: true, includeHidden: true }).isEnabled())
          await p.getByRole("button", { name: "← Previous", exact: true }).click();
        for (let n = 0; n < 20; n++) {
          await fits(p);
          await preview(p, `${mode}-large-text-${viewport.width}.png`);
          const next = p.getByRole("button", { name: "Next →", exact: true, includeHidden: true });
          if (!(await next.isEnabled())) break;
          await next.click();
          if (n === 19) throw Error("Unbounded controller pagination");
        }
      }
      expect(await p.evaluate(() => window.controllerActions)).toEqual([]);
      expect(f.errors).toEqual([]);
    } finally { await f.close(); }
  });

test("Backgammon paged points preserve order and submit the selected source and destination", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "CSS safe-area emulation requires CDP.");
  const f = await controller(browser, "backgammon", 4, { width: 568, height: 320 });
  try {
    const p = f.page;
    f.party.pack.dice = [1, 2];
    f.party.revision++;
    await p.reload();
    const cdp = await p.context().newCDPSession(p);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, bottom: 21, left: 44, right: 44 } });
    await p.evaluate(() => window.dispatchEvent(new Event("resize")));
    const order = [];
    for (let n = 0; n < 10; n++) {
      await fits(p);
      order.push(...await p.locator(".backgammon-points:visible button").evaluateAll(nodes => nodes.map(node => Number(node.textContent.split(":")[0]))));
      const next = p.getByRole("button", { name: "Next →", exact: true, includeHidden: true });
      if (!(await next.isEnabled())) break;
      await next.click();
    }
    expect(order).toEqual([...Array.from({ length: 12 }, (_, n) => 24 - n), ...Array.from({ length: 12 }, (_, n) => n + 1)]);
    expect(await p.evaluate(() => window.controllerActions)).toEqual([]);
    await p.getByRole("button", { name: "12: ● 5", exact: true }).click();
    await expect(p.locator(".backgammon-points button[data-selected=true]")).toContainText("12:");
    const destination = p.getByRole("button", { name: "14: ·", exact: true });
    for (let n = 0; n < 10 && !(await destination.isVisible()); n++) {
      await p.getByRole("button", { name: "← Previous", exact: true }).click();
      await fits(p);
    }
    await expect(destination).toBeVisible();
    expect(await p.evaluate(() => window.controllerActions)).toEqual([]);
    await destination.click();
    await expect.poll(() => f.party.pack.points[11]).toBe(4);
    expect(f.party.pack.points[13]).toBe(1);
    expect(await p.evaluate(() => window.controllerActions)).toEqual(["play"]);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

if (guestGames.some((game) => game.id === "homeward"))
  test("Homeward split choices fit both orientations and commit the previewed move", async ({
    browser,
  }) => {
    const f = await controller(browser, "homeward");
    try {
      const p = f.page,
        board = f.party.pack.tables[0];
      board.turn = 0;
      board.seats[0].pawns = [
        { zone: "safe", position: 4 },
        { zone: "track", position: 4 },
        { zone: "start", position: null },
        { zone: "start", position: null },
      ];
      const at = board.deck.indexOf("7");
      [board.deck[at], board.deck[board.deck.length - 1]] = [
        board.deck[board.deck.length - 1],
        board.deck[at],
      ];
      board.version++;
      f.party.revision++;
      await p.reload();
      await p.getByRole("button", { name: "Draw a card", exact: true }).click();
      await p.getByLabel("Move type", { exact: true }).selectOption("split");
      await p
        .getByRole("button", { name: "Pawn A · Safe 5", exact: true })
        .click();
      async function reach(locator) {
        for (let n = 0; n < 8 && !(await locator.isVisible()); n++) {
          const next = p.getByRole("button", {
            name: "Next →",
            exact: true,
            includeHidden: true,
          });
          if (await next.isEnabled()) await next.click();
          else
            await p
              .getByRole("button", { name: "← Previous", exact: true })
              .click();
        }
        await expect(locator).toBeVisible();
      }
      const steps = p.getByLabel("Steps for first pawn", { exact: true });
      await reach(steps);
      await steps.selectOption("1");
      await p.getByLabel("Second pawn", { exact: true }).selectOption("1");
      await expect(p.locator(".homeward-preview")).toContainText(
        "A → Home; B → Track 11",
      );
      for (const [width, height] of [
        [320, 480],
        [568, 320],
        [390, 844],
      ]) {
        await p.setViewportSize({ width, height });
        await p.waitForTimeout(80);
        while (
          await p
            .getByRole("button", {
              name: "← Previous",
              exact: true,
              includeHidden: true,
            })
            .isEnabled()
        )
          await p
            .getByRole("button", { name: "← Previous", exact: true })
            .click();
        for (let n = 0; n < 8; n++) {
          await fits(p);
          const next = p.getByRole("button", {
            name: "Next →",
            exact: true,
            includeHidden: true,
          });
          if (!(await next.isEnabled())) break;
          await next.click();
        }
      }
      const confirm = p.getByRole("button", {
        name: "Move both pawns",
        exact: true,
      });
      await reach(confirm);
      await confirm.click();
      await expect.poll(() => board.seats[0].pawns[0].zone).toBe("home");
      expect(board.seats[0].pawns[1].position).toBe(10);
      async function draw(card) {
        board.turn = 0;
        const at = board.deck.indexOf(card);
        expect(at).toBeGreaterThanOrEqual(0);
        [board.deck[at], board.deck[board.deck.length - 1]] = [
          board.deck[board.deck.length - 1],
          board.deck[at],
        ];
        board.version++;
        f.party.revision++;
        await p.reload();
        await p
          .getByRole("button", { name: "Draw a card", exact: true })
          .click();
      }
      await draw("11");
      const type = p.getByLabel("Move type", { exact: true });
      await reach(type);
      await type.selectOption("swap");
      const opponent = p.getByLabel("Opponent's pawn", { exact: true });
      await reach(opponent);
      await opponent.selectOption("1:0");
      await p.setViewportSize({ width: 568, height: 320 });
      await expect(p.locator("#game")).toHaveCSS("height", "320px");
      const swap = p.getByRole("button", { name: "Swap pawns", exact: true });
      await reach(swap);
      await fits(p);
      await swap.click();
      await expect.poll(() => board.seats[0].pawns[1].position).toBe(12);
      expect(board.seats[1].pawns[0].position).toBe(10);
      await draw("BUMP");
      const pawn = p.getByRole("button", {
        name: "Pawn C · Start",
        exact: true,
      });
      await reach(pawn);
      await pawn.click();
      await reach(opponent);
      await opponent.selectOption("1:0");
      const bump = p.getByRole("button", {
        name: "Bump opponent",
        exact: true,
      });
      await reach(bump);
      await fits(p);
      await bump.click();
      await expect.poll(() => board.seats[1].pawns[0].zone).toBe("start");
      expect(board.seats[0].pawns[2].position).toBe(10);
      expect(f.errors).toEqual([]);
    } finally {
      await f.close();
    }
  });
