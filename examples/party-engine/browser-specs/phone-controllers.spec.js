import { test, expect } from "@playwright/test";
import { WebSocket } from "ws";
import { createPartyServer } from "../server.js";
import { guestGames } from "../public/game-catalog.js";

// Only this fixture can manipulate its own clock. Production exposes no test API.
async function controller(browser, mode, count = 4) {
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
    viewport: { width: 320, height: 480 },
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
    const f = await controller(browser, game.id);
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
