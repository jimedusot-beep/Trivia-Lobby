import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { createPartyServer } from "../server.js";

// The fixture owns its local server. State seeding is not a public endpoint or a
// production option. Every tested player action still uses real guest sockets.
async function lobby(browser, count = 2) {
  let now = Date.now();
  const jobs = [];
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
      for (let n = 0; n < 20; n++) {
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
    }),
    contexts = [];
  try {
    await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    async function page(width = 390) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
      });
      contexts.push(context);
      return context.newPage();
    }
    const host = await page(1280);
    await host.goto(base);
    await host.locator('[data-game="homeward"] .pick-game-button').click();
    await expect(host.locator("#heading")).toContainText("lobby");
    const png = PNG.sync.read(
      await host.locator("#party-invitation svg").screenshot(),
    );
    const decoded = jsQR(
      new Uint8ClampedArray(png.data),
      png.width,
      png.height,
    );
    expect(decoded).toBeTruthy();
    const invite = await host.locator("#invite-link").inputValue();
    expect(decoded.data).toBe(invite);
    const pages = [];
    for (let index = 0; index < count; index++) {
      const p = await page(index === 0 ? 320 : 390);
      await p.goto(invite);
      await p
        .getByLabel("Nickname")
        .fill(
          index === 0 ? "Pawn Guest 1 WideNameXXXX" : `Pawn Guest ${index + 1}`,
        );
      await p.getByRole("button", { name: "Join party", exact: true }).click();
      await expect(p.locator("#heading")).toContainText("lobby");
      pages.push(p);
    }
    const code = (await host.locator("#heading").innerText()).split(" · ")[0],
      party = app.rooms.get(code).party;
    await host
      .getByRole("button", { name: "Start match", exact: true })
      .click();
    await expect(host.locator("#heading")).toContainText("countdown");
    time.advance(1);
    await expect(host.locator("#heading")).toContainText("playing");
    const ids = [...party.players.keys()],
      byId = (id) => pages[ids.indexOf(id)];
    async function seed(index, card, change = () => {}) {
      const board = party.pack.tables[index];
      change(board);
      const at = board.deck.indexOf(card);
      expect(at).toBeGreaterThanOrEqual(0);
      [board.deck[at], board.deck[board.deck.length - 1]] = [
        board.deck[board.deck.length - 1],
        board.deck[at],
      ];
      board.version++;
      party.revision++;
      const actor = byId(board.seats[board.turn].id);
      await actor.reload();
      await expect(actor.locator(".homeward-controller")).toHaveAttribute(
        "data-board-version",
        String(board.version),
      );
      return actor;
    }
    return {
      app,
      host,
      pages,
      party,
      byId,
      seed,
      close: async () => {
        await Promise.allSettled(contexts.map((context) => context.close()));
        await app.close();
      },
    };
  } catch (error) {
    await Promise.allSettled(contexts.map((context) => context.close()));
    await app.close();
    throw error;
  }
}
const noOverflow = async (page) => {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
};

test("Homeward: decoded QR, first-screen phone draw, keyboard pawn move and reload", async ({
  browser,
}) => {
  const f = await lobby(browser);
  try {
    const actor = await f.seed(0, "3", (board) => {
      board.turn = 0;
    });
    const board = f.party.pack.tables[0];
    const draw = actor.getByRole("button", {
        name: "Draw a card",
        exact: true,
      }),
      box = await draw.boundingBox();
    expect(box.y + box.height).toBeLessThan(844);
    await draw.focus();
    await actor.keyboard.press("Enter");
    await expect(actor.locator(".homeward-card-face")).toHaveText("3");
    await expect(
      f.host.getByRole("button", { name: "Draw a card", exact: true }),
    ).toHaveCount(0);
    await expect(
      f.pages[1].getByRole("button", { name: "Move pawn A", exact: true }),
    ).toHaveCount(0);
    const pawn = actor.getByRole("button", {
      name: "Pawn A · Track 1",
      exact: true,
    });
    await pawn.focus();
    await actor.keyboard.press("Enter");
    await expect(pawn).toBeFocused();
    await actor.keyboard.press("Tab");
    await expect(
      actor.getByRole("button", { name: "Move pawn A", exact: true }),
    ).toBeFocused();
    await actor.keyboard.press("Enter");
    await expect.poll(() => board.seats[0].pawns[0].position).toBe(3);
    await actor.getByText("View your board", { exact: true }).click();
    await expect(actor.locator(".homeward-board-panel")).toHaveAttribute(
      "open",
    );
    await actor.reload();
    await expect(actor.locator(".homeward-board-panel")).toHaveAttribute(
      "open",
    );
    await expect(actor.locator(".homeward-board svg")).toHaveAccessibleName(
      /Pawn Guest 1.*A Track 4/,
    );
    await noOverflow(actor);
  } finally {
    await f.close();
  }
});

test("Homeward: split-seven chooser previews both pawns and commits one atomic move", async ({
  browser,
}) => {
  const f = await lobby(browser);
  try {
    const actor = await f.seed(0, "7", (board) => {
      board.turn = 0;
      board.seats[0].pawns = [
        { zone: "safe", position: 4 },
        { zone: "track", position: 4 },
        { zone: "start", position: null },
        { zone: "start", position: null },
      ];
    });
    await actor
      .getByRole("button", { name: "Draw a card", exact: true })
      .click();
    await actor.getByLabel("Move type", { exact: true }).selectOption("split");
    await actor
      .getByRole("button", { name: "Pawn A · Safe 5", exact: true })
      .click();
    await actor
      .getByLabel("Steps for first pawn", { exact: true })
      .selectOption("1");
    await actor.getByLabel("Second pawn", { exact: true }).selectOption("1");
    await expect(actor.locator(".homeward-preview")).toContainText(
      "A → Home; B → Track 11",
    );
    const before = structuredClone(f.party.pack.tables[0].seats[0].pawns);
    expect(before[0].zone).toBe("safe");
    await actor
      .getByRole("button", { name: "Move both pawns", exact: true })
      .click();
    await expect
      .poll(() => f.party.pack.tables[0].seats[0].pawns[0].zone)
      .toBe("home");
    expect(f.party.pack.tables[0].seats[0].pawns[1].position).toBe(10);
    await noOverflow(actor);
  } finally {
    await f.close();
  }
});

test("Homeward: swap and Bump previews restrict targets to opposing track pawns", async ({
  browser,
}) => {
  const f = await lobby(browser);
  try {
    let actor = await f.seed(0, "11", (board) => {
      board.turn = 0;
      board.seats[0].pawns[0] = { zone: "track", position: 2 };
    });
    await actor
      .getByRole("button", { name: "Draw a card", exact: true })
      .click();
    await actor.getByLabel("Move type", { exact: true }).selectOption("swap");
    await actor
      .getByLabel("Opponent's pawn", { exact: true })
      .selectOption("1:0");
    await expect(actor.locator(".homeward-preview")).toContainText(
      "A → Track 25",
    );
    await actor
      .getByRole("button", { name: "Swap pawns", exact: true })
      .click();
    await expect
      .poll(() => f.party.pack.tables[0].seats[0].pawns[0].position)
      .toBe(24);
    expect(f.party.pack.tables[0].seats[1].pawns[0].position).toBe(2);
    actor = await f.seed(0, "BUMP");
    await actor
      .getByRole("button", { name: "Draw a card", exact: true })
      .click();
    await actor
      .getByRole("button", { name: "Pawn B · Start", exact: true })
      .click();
    await actor
      .getByLabel("Opponent's pawn", { exact: true })
      .selectOption("0:0");
    await expect(actor.locator(".homeward-preview")).toContainText("1 bumped");
    await actor
      .getByRole("button", { name: "Bump opponent", exact: true })
      .click();
    await expect
      .poll(() => f.party.pack.tables[0].seats[0].pawns[0].zone)
      .toBe("start");
    expect(f.party.pack.tables[0].seats[1].pawns[1].position).toBe(24);
    await noOverflow(actor);
  } finally {
    await f.close();
  }
});

test("Homeward: five guests share 3+2 boards, settle independently and finish with correct points", async ({
  browser,
}) => {
  const f = await lobby(browser, 5);
  try {
    expect(f.party.pack.tables.map((board) => board.seats.length)).toEqual([
      3, 2,
    ]);
    let actor = await f.seed(0, "1", (board) => {
      board.turn = 0;
      board.seats[0].pawns = [
        { zone: "home", position: null },
        { zone: "home", position: null },
        { zone: "home", position: null },
        { zone: "safe", position: 4 },
      ];
      board.seats[1].pawns = [
        { zone: "home", position: null },
        { zone: "safe", position: 0 },
        { zone: "start", position: null },
        { zone: "start", position: null },
      ];
    });
    await actor
      .getByRole("button", { name: "Draw a card", exact: true })
      .click();
    await actor
      .getByRole("button", { name: "Move pawn D", exact: true })
      .click();
    await expect(actor.locator(".homeward-controller")).toContainText(
      "Other boards are still playing",
    );
    expect(f.party.pack.tables[0].result.points).toEqual([100, 25, 0]);
    expect(f.party.phase).toBe("playing");
    await f.host
      .getByLabel("Board on the shared screen", { exact: true })
      .selectOption("1");
    actor = await f.seed(1, "1", (board) => {
      board.turn = 0;
      board.seats[0].pawns = [
        { zone: "home", position: null },
        { zone: "home", position: null },
        { zone: "home", position: null },
        { zone: "safe", position: 4 },
      ];
    });
    await actor
      .getByRole("button", { name: "Draw a card", exact: true })
      .click();
    await actor
      .getByRole("button", { name: "Move pawn D", exact: true })
      .click();
    await expect(f.host.locator("#heading")).toContainText("reveal");
    await f.host.getByRole("button", { name: "Next", exact: true }).click();
    await expect(f.host.locator("#heading")).toContainText("finished");
    expect([...f.party.players.values()].map((player) => player.score)).toEqual(
      [100, 25, 0, 100, 0],
    );
    await noOverflow(actor);
  } finally {
    await f.close();
  }
});

test("Homeward: blocked two keeps the turn, while an optional eleven swap can be skipped", async ({
  browser,
}) => {
  const f = await lobby(browser);
  try {
    let actor = await f.seed(0, "2", (board) => {
      board.turn = 0;
      board.seats[0].pawns = [
        { zone: "home", position: null },
        { zone: "home", position: null },
        { zone: "home", position: null },
        { zone: "safe", position: 4 },
      ];
    });
    await actor
      .getByRole("button", { name: "Draw a card", exact: true })
      .click();
    await expect(actor.locator(".homeward-controller")).toContainText(
      "No legal move for this card",
    );
    await actor
      .getByRole("button", { name: "No legal moves · end turn", exact: true })
      .click();
    await expect(
      actor.getByRole("button", { name: "Draw a card", exact: true }),
    ).toBeVisible();
    expect(f.party.pack.tables[0].turn).toBe(0);
    actor = await f.seed(0, "11", (board) => {
      board.seats[0].pawns[3] = { zone: "track", position: 46 };
    });
    await actor
      .getByRole("button", { name: "Draw a card", exact: true })
      .click();
    await expect(
      actor.getByRole("button", { name: "Swap pawns", exact: true }),
    ).toBeVisible();
    await actor
      .getByRole("button", { name: "Skip optional swap", exact: true })
      .click();
    await expect.poll(() => f.party.pack.tables[0].turn).toBe(1);
    expect(f.party.pack.tables[0].seats[0].pawns[3].position).toBe(46);
    await noOverflow(actor);
  } finally {
    await f.close();
  }
});
