import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { mkdir } from "node:fs/promises";
import path from "node:path";
const base = "http://127.0.0.1:4317";
async function lobby(browser, mode, count = 2) {
  const contexts = [];
  async function page(width = 390) {
    const c = await browser.newContext({ viewport: { width, height: 844 } });
    contexts.push(c);
    return c.newPage();
  }
  const host = await page(1280);
  await host.goto(base);
  await host.locator(`[data-game="${mode}"] button`).click();
  await expect(host.locator("#heading")).toContainText("lobby");
  const qr = host.locator("#party-invitation svg"),
    png = PNG.sync.read(await qr.screenshot()),
    decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded).toBeTruthy();
  const invite = decoded.data;
  expect(invite).toBe(await host.locator("#invite-link").inputValue());
  const players = [];
  for (let n = 0; n < count; n++) {
    const p = await page();
    await p.goto(invite);
    await p.getByLabel("Nickname").fill(`Guest ${n}`);
    await p.getByRole("button", { name: "Join party", exact: true }).click();
    await expect(p.locator("#heading")).toContainText("lobby");
    players.push(p);
  }
  async function start() {
    await host
      .getByRole("button", { name: "Start match", exact: true })
      .click();
    await expect(host.locator("#heading")).toContainText("playing");
  }
  return {
    host,
    players,
    start,
    close: () => Promise.all(contexts.map((c) => c.close())),
  };
}
async function noOverflow(page) {
  if (process.env.GAME_PACK_SCREENSHOT_DIR) {
    await mkdir(process.env.GAME_PACK_SCREENSHOT_DIR, {recursive:true});
    const name=test.info().title.replace(/[^a-z0-9]+/gi,"-").slice(0,65)+".png";
    await page.locator(".open-game").screenshot({path:path.join(process.env.GAME_PACK_SCREENSHOT_DIR,name)});
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
}

test("Family Showdown: decoded QR, phone buzzer, hidden board, host judge and reconnect", async ({
  browser,
}) => {
  const f = await lobby(browser, "feud", 4);
  try {
    await f.start();
    const p = f.players[0];
    await expect(
      p.getByRole("button", { name: "BUZZ!", exact: true }),
    ).toBeVisible();
    await p.getByRole("button", { name: "BUZZ!", exact: true }).click();
    await expect(f.host.locator("#content")).toContainText(
      "Guest 0 buzzed first",
    );
    await f.host.getByText("Private host controls", { exact: true }).click();
    await f.host
      .getByRole("button", { name: "Reveal Sandwiches (+35)", exact: true })
      .click();
    await expect(p.locator(".feud-board")).toContainText("Sandwiches — 35");
    await expect(p.locator(".feud-board")).not.toContainText("Blanket");
    await p.reload();
    await expect(p.locator(".feud-board")).toContainText("Sandwiches — 35");
    await noOverflow(p);
  } finally {
    await f.close();
  }
});

test("Doodle Dash: private word, pointer drawing, keyboard stroke, guess and canvas recovery", async ({
  browser,
}) => {
  const f = await lobby(browser, "draw");
  try {
    await f.start();
    const [artist, guesser] = f.players;
    const word = await artist.locator(".open-game button").first().innerText();
    await artist.getByRole("button", { name: word, exact: true }).click();
    await expect(guesser.locator("#content")).not.toContainText(
      `Your private word: ${word}`,
    );
    await expect(artist.getByLabel("Pen color", {exact:true})).toBeVisible();
    const pad = artist.locator(".doodle-pad");
    await expect(pad).toBeVisible();
    await pad.scrollIntoViewIfNeeded();
    const box = await pad.boundingBox();
    expect(box).toBeTruthy();
    await artist.mouse.move(box.x + 20, box.y + 20);
    await artist.mouse.down();
    await artist.mouse.move(box.x + 80, box.y + 90, { steps: 5 });
    await artist.mouse.up();
    await expect(guesser.locator(".doodle-pad polyline")).toHaveCount(1);
    await pad.focus();
    await artist.keyboard.press("ArrowRight");
    await artist.keyboard.press("Enter");
    await expect(guesser.locator(".doodle-pad polyline")).toHaveCount(2);
    await artist.reload();
    await expect(artist.locator(".doodle-pad polyline")).toHaveCount(2);
    await guesser.getByLabel("Guess the drawing").fill(word);
    await guesser
      .locator(".pack-entry")
      .getByRole("button", { name: "Submit" })
      .click();
    await expect(f.host.locator("#heading")).toContainText("reveal");
    await expect(guesser.locator("#content")).toContainText(
      `The word was: ${word}`,
    );
    await noOverflow(guesser);
  } finally {
    await f.close();
  }
});

test("Color Clash: saved house settings, private hand, legal action and hand recovery", async ({
  browser,
}) => {
  const f = await lobby(browser, "colors");
  try {
    await f.host.getByLabel("Draw-card stacking").selectOption("true");
    await f.host.getByLabel("Computer players").selectOption("1");
    await f.host.reload();
    await expect(f.host.getByLabel("Draw-card stacking")).toHaveValue("true");
    await expect(f.host.getByLabel("Computer players")).toHaveValue("1");
    await f.start();
    const p = f.players[0];
    await expect(p.locator(".card-hand .color-card")).toHaveCount(7);
    expect((await p.locator(".card-hand").boundingBox()).height).toBeLessThan(400);
    await expect(f.host.locator(".card-hand .color-card")).toHaveCount(0);
    await expect(p.locator("#content")).toContainText("Spark Bot 1");
    const before = await p.locator(".card-hand .color-card").allTextContents();
    await p.reload();
    await expect(p.locator(".card-hand .color-card")).toHaveText(before);
    await p.getByRole("button", { name: "Draw a card", exact: true }).click();
    await expect(p.locator("#status")).toHaveText("Submission accepted.");
    await noOverflow(p);
  } finally {
    await f.close();
  }
});

for (const mode of ["four", "chess", "checkers", "reversi", "mancala"])
  test(`${mode}: two paired phone tables, a legal move, reconnect and no horizontal overflow`, async ({
    browser,
  }) => {
    const f = await lobby(browser, mode, 4);
    try {
      await f.start();
      const p = f.players[0];
      await expect(f.host.locator(".board-table")).toHaveCount(2);
      await expect(p.locator(".board-table")).toHaveCount(1);
      await expect(p.locator(".board-table")).toContainText(
        "Guest 0 vs Guest 1",
      );
      if (mode === "four")
        await p.getByRole("button", { name: "Drop 1", exact: true }).click();
      if (mode === "chess") {
        await p
          .getByRole("button", { name: "e2 white pawn", exact: true })
          .click();
        await p.getByRole("button", { name: "e4 empty", exact: true }).click();
      }
      if (mode === "checkers") {
        await p.locator('[data-square="40"]').click();
        await p.locator('[data-square="33"]').click();
      }
      if (mode === "reversi") await p.locator('[data-square="19"]').click();
      if (mode === "mancala")
        await p.getByRole("button", { name: "Pit 1: 4", exact: true }).click();
      await expect(p.locator("#status")).toHaveText("Submission accepted.");
      await p.reload();
      await expect(p.locator(".board-table")).toContainText("Guest 1's turn");
      await noOverflow(p);
    } finally {
      await f.close();
    }
  });

test("Card table: private hands, public plays, chips and host award", async ({
  browser,
}) => {
  const f = await lobby(browser, "table");
  try {
    await f.start();
    const p = f.players[0],
      other = f.players[1];
    await expect(p.locator(".card-hand .standard-card")).toHaveCount(5);
    await p.locator(".card-hand .standard-card").first().click();
    await expect(other.locator(".card-hand .standard-card")).toHaveCount(6);
    await p.getByLabel("Play chips to add to pot").fill("10");
    await p
      .getByRole("button", { name: "Add chips to pot", exact: true })
      .click();
    await expect(f.host.locator("#content")).toContainText(
      "Pot: 10 play chips",
    );
    await f.host
      .getByRole("button", {
        name: "Award pot to selected player",
        exact: true,
      })
      .click();
    await expect(f.host.locator("#content")).toContainText("Pot: 0 play chips");
    await p.reload();
    await expect(p.locator(".card-hand .standard-card")).toHaveCount(5);
    await noOverflow(p);
  } finally {
    await f.close();
  }
});

test("Backgammon: roll, select, move, shared board and end turn", async ({
  browser,
}) => {
  const f = await lobby(browser, "backgammon");
  try {
    await f.start();
    const p = f.players[0];
    await p.getByRole("button", { name: "Roll dice", exact: true }).click();
    await p.getByRole("button", { name: "1: ● 2", exact: true }).click();
    await p.getByRole("button", { name: "2: ·", exact: true }).click();
    await expect(
      f.players[1].getByRole("button", { name: "2: ● 1", exact: true }),
    ).toBeVisible();
    await p.getByRole("button", { name: "End turn", exact: true }).click();
    await expect(
      f.players[1].getByRole("button", { name: "Roll dice", exact: true }),
    ).toBeVisible();
    await p.reload();
    await expect(p.locator("#content")).toContainText("Guest 1's turn");
    await noOverflow(p);
  } finally {
    await f.close();
  }
});

test("Custom showdown: edit, export-compatible save and host without signing in", async ({
  page,
}) => {
  await page.goto(base + "/show.html");
  await page.getByLabel("Show title", { exact: true }).fill("Our family show");
  await page
    .getByRole("button", { name: "Save & host showdown", exact: true })
    .click();
  await expect(page.locator("#heading")).toContainText("lobby");
  await expect(page.getByLabel("Game mode", { exact: true })).toHaveValue(
    "feud",
  );
  await page.reload();
  await expect(page.getByLabel("Game mode", { exact: true })).toHaveValue(
    "feud",
  );
});

test("Razzia import: save locally and preserve timer and scoring while editing", async ({
  page,
}) => {
  await page.goto(base + "/create.html");
  await page
    .locator("#import-file")
    .setInputFiles({
      name: "razzia.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          subject: "Our imported quiz",
          questions: [
            {
              question: "Which is blue?",
              answers: ["Sky", "Grass"],
              solutions: [0],
              time: 15,
              maxPoints: 500,
              penalty: 50,
              note: "Our sky",
            },
          ],
        }),
      ),
    });
  await expect(page.locator("#status")).toContainText("Imported 1 questions");
  await expect(page.locator("#quiz-title")).toHaveValue("Our imported quiz");
  await page
    .getByRole("button", { name: "Edit question 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Update question", exact: true })
    .click();
  await page.locator("#save-quiz").click();
  await expect(page.locator("#status")).toContainText("Saved");
});

test("Credits offer exact guest source, six pinned upstream records and license notices", async ({
  page,
  request,
}) => {
  await page.goto(base + "/sources.html");
  await expect(page.locator("#source-list article")).toHaveCount(7);
  const response = await request.get(base + "/open-source/source.json");
  expect(response.ok()).toBe(true);
  const source = await response.json();
  expect(
    source.files.some((f) => f.path.endsWith("open-pack/board-rules.js")),
  ).toBe(true);
  expect(source.files.some((f) => /\.env/.test(f.path))).toBe(false);
  expect((await request.get(base + "/open-source/boards.txt")).ok()).toBe(true);
});


test("Game categories keep all 24 modes easy to browse", async ({page}) => {
  await page.goto(base);
  await expect(page.locator(".pick-game-card:visible")).toHaveCount(24);
  await page.getByRole("button",{name:"Cards & dice",exact:true}).click();
  await expect(page.locator(".pick-game-card:visible")).toHaveCount(2);
  await expect(page.locator('[data-game="colors"]')).toBeVisible();
  await page.getByRole("button",{name:"Board games",exact:true}).click();
  await expect(page.locator(".pick-game-card:visible")).toHaveCount(6);
  await page.getByRole("button",{name:"Party & trivia",exact:true}).click();
  await expect(page.locator(".pick-game-card:visible")).toHaveCount(16);
  await page.getByRole("button",{name:"All games",exact:true}).click();
  await expect(page.locator(".pick-game-card:visible")).toHaveCount(24);
});

test("Drawing waits for a slow submission instead of showing a stroke that was never sent", async ({browser}) => {
  const f=await lobby(browser,"draw");
  try {
    await f.start();
    const [artist,guesser]=f.players;
    await artist.locator(".open-game button").first().click();
    await expect(artist.getByLabel("Pen color",{exact:true})).toBeVisible();
    await artist.evaluate(()=>{
      const send=WebSocket.prototype.send, seen=new Set();
      window.__heldStrokes=[];
      WebSocket.prototype.send=function(raw){
        const msg=JSON.parse(raw);
        if(msg.type==="play"&&msg.value?.action==="stroke"){
          if(!seen.has(msg.requestId)){seen.add(msg.requestId);window.__heldStrokes.push(()=>send.call(this,raw));}
        } else send.call(this,raw);
      };
    });
    const pad=artist.locator(".doodle-pad");
    await pad.scrollIntoViewIfNeeded();
    const box=await pad.boundingBox();
    async function stroke(offset){
      await artist.mouse.move(box.x+20+offset,box.y+20);
      await artist.mouse.down();
      await artist.mouse.move(box.x+50+offset,box.y+60,{steps:3});
      await artist.mouse.up();
    }
    await stroke(0);
    await expect(pad).toHaveAttribute("aria-disabled","true");
    await stroke(60);
    expect(await artist.evaluate(()=>window.__heldStrokes.length)).toBe(1);
    await expect(guesser.locator(".doodle-pad polyline")).toHaveCount(0);
    await artist.evaluate(()=>window.__heldStrokes.shift()());
    await expect(guesser.locator(".doodle-pad polyline")).toHaveCount(1);
    await expect(pad).toHaveAttribute("aria-disabled","false");
    await artist.reload();
    await expect(artist.locator(".doodle-pad polyline")).toHaveCount(1);
  } finally { await f.close(); }
});
