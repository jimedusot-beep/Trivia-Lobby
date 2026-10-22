import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

type Mode = "teams" | "buzzer" | "wager" | "workshop" | "party";
type Match = { host: Page; players: Page[]; advance: () => Promise<void>; finish: () => Promise<void> };

async function match(
  browser: Browser, baseURL: string | undefined, mode: Mode, rounds: number, playerCount: number,
  play: (game: Match) => Promise<void>,
) {
  const contexts: BrowserContext[] = [];
  let deckId: number | undefined;
  try {
    const hostContext = await browser.newContext({ reducedMotion: "reduce" });
    contexts.push(hostContext);
    const signup = await hostContext.request.post(baseURL + "/api/auth/register", {
      data: { email: `${mode}-${crypto.randomUUID()}@example.test`, password: "Mode-test-passphrase-2026" },
    });
    expect(signup.status()).toBe(201);
    const imported = await hostContext.request.post(baseURL + "/api/decks/import", { data: {
      deck: { title: `${mode} browser acceptance` },
      cards: Array.from({ length: rounds }, (_, index) => ({
        front: `${mode} question ${index + 1}`, back: "The first option is correct.",
        type: "multiple_choice", options: ["Right", "Wrong"], correctOption: "A",
      })),
    } });
    expect(imported.status()).toBe(201);
    deckId = (await imported.json()).id;
    const host = await hostContext.newPage();
    await host.goto(baseURL + `/host/${deckId}`);
    const code = host.getByTestId("room-code");
    await expect(code).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/);
    await host.getByLabel("Game mode", { exact: true }).selectOption(mode);
    await expect(host.getByLabel("Game mode", { exact: true })).toHaveValue(mode);

    const players: Page[] = [];
    for (let index = 0; index < playerCount; index++) {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
      contexts.push(context);
      await context.addInitScript(() => {
        // Record even a short-lived canvas so the check cannot pass merely
        // because a celebration finished before the assertion ran.
        new MutationObserver(records => {
          if (records.some(record => Array.from(record.addedNodes).some(node => node instanceof HTMLCanvasElement))) {
            document.documentElement.dataset.animationCanvasCreated = "true";
          }
        }).observe(document, { childList: true, subtree: true });
      });
      const player = await context.newPage();
      players.push(player);
      await player.goto(baseURL + "/join");
      await player.getByLabel("Room Code", { exact: true }).fill((await code.innerText()).trim());
      await player.getByLabel("Your Name", { exact: true }).fill(["Player Ada", "Player Grace", "Player Lin"][index]);
      await player.getByRole("button", { name: "Enter Game", exact: true }).click();
      await expect(player.getByRole("heading", { name: "Joined lobby", exact: true })).toBeVisible();
      await expect(player.getByText(new RegExp(`Mode: ${mode}`))).toBeVisible();
      if (mode === "teams") await expect(player.getByText(`Mode: teams · Team ${index % 2 + 1}`, { exact: true })).toBeVisible();
    }
    await expect(host.getByText(`${playerCount} Players`, { exact: true })).toBeVisible();
    await host.getByRole("button", { name: "Start Game", exact: true }).click();
    await expect(players[0].getByText(`${mode} question 1`, { exact: true })).toBeVisible();

    const advance = async () => {
      await host.getByRole("button", { name: "Show leaderboard", exact: true }).click();
      await host.getByRole("button", { name: "Next / Finish", exact: true }).click();
    };
    const finish = async () => {
      await advance();
      await expect(host.getByRole("heading", { name: "GAME OVER", exact: true })).toBeVisible();
      for (const player of players) {
        await expect(player.getByRole("heading", { name: "Game Over!", exact: true })).toBeVisible();
        expect(await player.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await player.locator("html").getAttribute("data-animation-canvas-created")).toBeNull();
      }
    };
    await play({ host, players, advance, finish });
  } finally {
    if (deckId && contexts[0]) await contexts[0].request.delete(baseURL + `/api/decks/${deckId}`).catch(() => {});
    await Promise.all(contexts.map(context => context.close()));
  }
}

const choose = (page: Page, correct = true) => page.getByRole("button", { name: correct ? "A: Right" : "B: Wrong", exact: true });
async function award(page: Page, points: number) {
  await expect(page.getByRole("heading", { name: points > 0 ? "Correct!" : "Incorrect or missed", exact: true })).toBeVisible();
  if (points !== 0) await expect(page.getByText(`${points > 0 ? "+" : ""}${points} pts`, { exact: true })).toBeVisible();
}

test("teams retain balanced membership and server-computed scores through finish", async ({ browser, baseURL }) => {
  await match(browser, baseURL, "teams", 2, 3, async ({ host, players: [ada, grace, lin], advance, finish }) => {
    await choose(ada).click();
    await choose(grace, false).click();
    await choose(lin).click();
    await award(ada, 100);
    await award(grace, 0);
    await award(lin, 100);
    await expect(host.getByText("Team 1: 200 pts", { exact: true })).toBeVisible();
    await expect(host.getByText("Team 2: 0 pts", { exact: true })).toBeVisible();
    await advance();
    await choose(ada).click();
    await choose(grace).click();
    await choose(lin, false).click();
    await award(ada, 110);
    await award(grace, 100);
    await award(lin, 0);
    await expect(host.getByText("Team 1: 310 pts", { exact: true })).toBeVisible();
    await expect(host.getByText("Team 2: 100 pts", { exact: true })).toBeVisible();
    await finish();
  });
});

test("buzzer ownership expires and passes after a wrong answer", async ({ browser, baseURL }) => {
  await match(browser, baseURL, "buzzer", 2, 2, async ({ players: [ada, grace], advance, finish }) => {
    await expect(choose(ada)).toBeDisabled();
    await expect(choose(grace)).toBeDisabled();
    await ada.getByRole("button", { name: "Buzz in", exact: true }).click();
    await expect(choose(ada)).toBeEnabled();
    await expect(grace.getByText("Another player has the buzzer", { exact: true })).toBeVisible();
    await expect(choose(grace)).toBeDisabled();
    await expect(grace.getByRole("button", { name: "Buzz in", exact: true })).toBeEnabled({ timeout: 8000 });
    await expect(choose(ada)).toBeDisabled();
    await grace.getByRole("button", { name: "Buzz in", exact: true }).click();
    await choose(grace).click();
    await award(grace, 100);
    await award(ada, 0);
    await advance();
    await ada.getByRole("button", { name: "Buzz in", exact: true }).click();
    await choose(ada, false).click();
    await expect(ada.getByText("Answer received. Waiting for reveal…", { exact: true })).toBeVisible();
    await grace.getByRole("button", { name: "Buzz in", exact: true }).click();
    await choose(grace).click();
    await award(grace, 110);
    await award(ada, 0);
    await finish();
  });
});

test("wagers are limited to earned points and produce visible gains and losses", async ({ browser, baseURL }) => {
  await match(browser, baseURL, "wager", 3, 1, async ({ players: [player], advance, finish }) => {
    await expect(player.getByLabel(/Wager earned points/)).toHaveAttribute("max", "0");
    await choose(player).click();
    await award(player, 100);
    await advance();
    await expect(player.getByLabel(/Wager earned points/)).toHaveAttribute("max", "100");
    await player.getByLabel(/Wager earned points/).fill("50");
    await choose(player).click();
    await award(player, 160);
    await expect(player.getByText("260 pts", { exact: true })).toBeVisible();
    await advance();
    await player.reload();
    await expect(player.getByLabel(/Wager earned points/)).toHaveAttribute("max", "100");
    await player.getByLabel(/Wager earned points/).fill("100");
    await choose(player, false).click();
    await award(player, -100);
    await expect(player.getByText("160 pts", { exact: true })).toBeVisible();
    await finish();
  });
});

test("workshop purchases persist on reconnect and consume focus and guard once", async ({ browser, baseURL }) => {
  await match(browser, baseURL, "workshop", 6, 1, async ({ players: [player], advance, finish }) => {
    await choose(player).click();
    await award(player, 100);
    await expect(player.getByRole("heading", { name: "Workshop · 80 coins", exact: true })).toBeVisible();
    const focus = player.getByRole("button", { name: "Focus charge · 60 coins", exact: true });
    await focus.click();
    await expect(focus).toBeDisabled();
    await player.reload();
    await expect(player.getByRole("heading", { name: "Workshop · 20 coins", exact: true })).toBeVisible();
    await expect(focus).toBeDisabled();
    await advance();
    await choose(player).click();
    await award(player, 160);
    await expect(player.getByRole("heading", { name: "Workshop · 40 coins", exact: true })).toBeVisible();
    await player.getByRole("button", { name: "Second wind · 40 coins", exact: true }).click();
    await expect(player.getByRole("heading", { name: "Workshop · 0 coins", exact: true })).toBeVisible();
    await advance();
    await choose(player, false).click();
    await award(player, 0);
    await advance();
    await choose(player).click();
    // Focus was consumed in round two; guard preserved the two-answer streak.
    await award(player, 120);
    await expect(player.getByText("380 pts", { exact: true })).toBeVisible();
    await advance();
    await choose(player, false).click();
    await award(player, 0);
    await advance();
    await choose(player).click();
    // Guard was consumed by the first miss, so the second miss reset the streak.
    await award(player, 100);
    await expect(player.getByText("480 pts", { exact: true })).toBeVisible();
    await finish();
  });
});

test("party doubles only the third round and restores the mode after host reload", async ({ browser, baseURL }) => {
  await match(browser, baseURL, "party", 3, 1, async ({ host, players: [player], advance, finish }) => {
    for (const points of [100, 110]) {
      await choose(player).click();
      await award(player, points);
      await advance();
    }
    await host.reload();
    await expect(host.getByRole("heading", { name: "party question 3", exact: true })).toBeVisible();
    await choose(player).click();
    await award(player, 240);
    await expect(player.getByText("450 pts", { exact: true })).toBeVisible();
    await finish();
  });
});
