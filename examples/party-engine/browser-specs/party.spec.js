import { test, expect } from "@playwright/test";
async function lobby(browser) {
  const contexts = [];
  const page = async (mobile) => {
    const c = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1280, height: 800 },
    });
    contexts.push(c);
    const p = await c.newPage();
    await p.goto("http://127.0.0.1:4317");
    await expect(p.locator("#status")).toHaveText("Connected.");
    return p;
  };
  const host = await page(false);
  await host.getByRole("button", { name: "Create host screen" }).click();
  await expect(host.locator("#heading")).toContainText("lobby");
  const code = (await host.locator("#heading").innerText()).split(" · ")[0],
    players = [];
  for (let i = 0; i < 3; i++) {
    const p = await page(true);
    await p.getByLabel("Party code").fill(code);
    await p.getByLabel("Nickname").fill(`Guest ${i}`);
    await p.getByRole("button", { name: "Join party", exact: true }).click();
    await expect(p.locator("#heading")).toContainText("lobby");
    players.push(p);
  }
  await expect(host.locator("#roster li")).toHaveCount(3);
  return {
    host,
    players,
    close: () => Promise.all(contexts.map((c) => c.close())),
  };
}
test("idle host clock avoids redundant DOM mutations while active countdown still advances", async ({ browser }) => {
  const f = await lobby(browser);
  try {
    const timer = f.host.locator("#timer");
    await expect(timer).toBeEmpty();
    await expect(timer).toHaveAttribute("data-urgent", "false");
    const idleMutations = await f.host.evaluate(async () => {
      const node = document.getElementById("timer");
      let changes = 0;
      const observer = new MutationObserver(records => { changes += records.length; });
      observer.observe(node, { attributes: true, childList: true, characterData: true, subtree: true });
      await new Promise(resolve => setTimeout(resolve, 800));
      observer.disconnect();
      return changes;
    });
    expect(idleMutations).toBe(0);
    await f.host.getByRole("button", { name: "Start match", exact: true }).click();
    await expect(timer).toContainText("seconds remaining");
    const first = await timer.textContent();
    await expect.poll(() => timer.textContent(), { timeout: 2500 }).not.toBe(first);
  } finally {
    await f.close();
  }
});

test("mobile-sized players finish Quiz and return to the same party", async ({
  browser,
}) => {
  const f = await lobby(browser);
  try {
    const code = (await f.host.locator("#heading").innerText()).split(" · ")[0];
    await f.host
      .getByRole("button", { name: "Start match", exact: true })
      .click();
    const correct = ["Triangle", "17", "Direction", "Ohm", "120"];
    for (const choice of correct) {
      await expect(f.host.locator("#heading")).toContainText("question");
      for (const p of f.players)
        await p.getByRole("button", { name: choice, exact: true }).click();
      await expect(f.host.locator("#heading")).toContainText("reveal");
      await f.host.getByRole("button", { name: "Next", exact: true }).click();
    }
    await expect(f.host.locator("#heading")).toContainText("finished");
    await expect(f.host.locator("#roster")).toContainText("500 points");
    await f.host.getByRole("button", { name: "Return to same party" }).click();
    await expect(f.host.locator("#heading")).toHaveText(`${code} · lobby`);
  } finally {
    await f.close();
  }
});
test("Prompt Duel renders private writing, eligible votes and results", async ({
  browser,
}) => {
  const f = await lobby(browser);
  try {
    await f.host.getByLabel("Game mode").selectOption("duel");
    await f.host
      .getByRole("button", { name: "Start match", exact: true })
      .click();
    for (const [i, p] of f.players.entries()) {
      await expect(p.locator("textarea")).toHaveCount(2);
      for (let n = 0; n < 2; n++) {
        const input = p.locator("textarea").first();
        await input.fill(`Guest ${i} original answer ${n}`);
        await input
          .locator("..")
          .getByRole("button", { name: "Lock response" })
          .click();
        await expect(p.locator("textarea")).toHaveCount(1 - n);
      }
    }
    await expect(f.host.locator("#heading")).toContainText("voting");
    await expect(f.host.locator("#content")).not.toContainText("— Guest");
    for (const p of f.players)
      await expect(p.locator("#heading")).toContainText("voting");
    for (const p of f.players) {
      const choices = p.locator(".phone-choices button");
      if (await choices.count()) {
        await choices.first().click();
        break;
      }
    }
    await expect(f.host.locator("#heading")).toContainText("reveal");
    await expect(f.host.locator("#content")).toContainText("votes");
  } finally {
    await f.close();
  }
});
test("Charades keeps words on the performer device and rotates all three turns", async ({
  browser,
}) => {
  const f = await lobby(browser);
  try {
    await f.host.getByLabel("Game mode").selectOption("charades");
    await f.host.getByLabel("Charades pack").selectOption("animals");
    await f.host
      .getByRole("button", { name: "Start match", exact: true })
      .click();
    for (let turn = 0; turn < 3; turn++) {
      const performer = f.players[turn];
      await expect(performer.locator("#current-clue")).toBeVisible();
      await expect(f.host.locator("#current-clue")).toHaveCount(0);
      for (const p of f.players.filter((p) => p !== performer))
        await expect(
          p.getByRole("button", { name: "Correct (+1)", exact: true }),
        ).toHaveCount(0);
      for (let n = 0; n < 16; n++) {
        const word = await performer.locator("#current-clue").innerText();
        await performer
          .getByRole("button", { name: "Correct (+1)", exact: true })
          .click();
        if (n < 15)
          await expect(performer.locator("#current-clue")).not.toHaveText(word);
        else
          await expect(performer.locator("#heading")).toContainText("reveal");
      }
      await expect(
        f.host.getByRole("heading", { name: "Turn summary" }),
      ).toBeVisible();
      await f.host.getByRole("button", { name: "Next", exact: true }).click();
    }
    await expect(f.host.locator("#heading")).toContainText("finished");
    await expect(f.host.locator("#roster li")).toHaveText([
      /16 points/,
      /16 points/,
      /16 points/,
    ]);
  } finally {
    await f.close();
  }
});
