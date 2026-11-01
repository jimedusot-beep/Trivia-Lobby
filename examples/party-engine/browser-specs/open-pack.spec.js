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
  await host.locator(`[data-game="${mode}"] .pick-game-button`).click();
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

test("Family Showdown: visible phone buzzer, private review, typed answers, three strikes and steal", async ({
  browser,
}) => {
  const f = await lobby(browser, "feud", 4);
  try {
    await f.start();
    const p = f.players[0];
    await p.setViewportSize({width:320,height:844});
    await expect(
      p.getByRole("button", { name: "BUZZ!", exact: true }),
    ).toBeVisible();
    const buzzer=await p.getByRole("button",{name:"BUZZ!",exact:true}).boundingBox();
    expect(buzzer.y+buzzer.height).toBeLessThan(844);
    await expect(p.locator(".feud-board-panel")).not.toHaveAttribute("open");
    await p.getByRole("button", {name:"Game info",exact:true}).click();
    await p.getByText("View the answer board",{exact:true}).click();
    await p.getByRole("button", {name:"Back to game",exact:true}).click();
    await p.getByRole("button", { name: "BUZZ!", exact: true }).click();
    await expect(p.locator(".feud-board-panel")).toHaveAttribute("open");
    await expect(f.host.locator("#content")).toContainText(
      "Guest 0 buzzed first",
    );
    await p.getByLabel("Your team's answer",{exact:true}).fill("packed lunches");
    await p.getByRole("button",{name:"Send answer",exact:true}).click();
    await expect(p.locator(".feud-controller")).toContainText("Waiting for the host");
    await expect(f.players[1].locator("#content")).not.toContainText("packed lunches");
    await expect(f.host.locator(".feud-controller")).not.toContainText("packed lunches");
    await expect(f.host.locator(".feud-submitted-answer")).not.toBeVisible();
    await f.host.getByText("Private host controls", { exact: true }).click();
    await expect(f.host.locator(".feud-submitted-answer")).toHaveText("packed lunches");
    await f.host
      .getByRole("button", { name: "Reveal Sandwiches (+35)", exact: true })
      .click();
    await expect(p.locator(".feud-board li").filter({hasText:"Sandwiches"}).locator("strong")).toHaveText("35");
    await expect(p.locator(".feud-board")).not.toContainText("Blanket");
    await p.reload();
    await expect(p.locator(".feud-board li").filter({hasText:"Sandwiches"}).locator("strong")).toHaveText("35");
    await p.getByLabel("Your team's answer",{exact:true}).fill("Blanket");
    await p.getByRole("button",{name:"Send answer",exact:true}).click();
    await expect(p.locator(".feud-decision")).toContainText("Blanket revealed");
    for(let strike=1;strike<=3;strike++){
      await f.host.getByRole("button",{name:"Strike — answer not on board",exact:true}).click();
      await expect(f.host.locator(".feud-strikes")).toContainText(`Strikes: ${strike} / 3`);
    }
    const stealer=f.players[1];
    await expect(p.getByLabel("Your team's answer",{exact:true})).toHaveCount(0);
    await stealer.getByLabel("Your team's answer",{exact:true}).fill("Water");
    await stealer.getByRole("button",{name:"Send answer",exact:true}).click();
    await expect(f.host.locator(".feud-controller")).toContainText("Starlight wins the 80-point pot!");
    await expect(p.locator(".feud-board-panel")).toHaveAttribute("open");
    await noOverflow(p);
  } finally {
    await f.close();
  }
});

test("Family Showdown: full phone match, retained duplicate draft, private final review and scoring", async ({browser})=>{
  const f=await lobby(browser,"feud",4);
  try {
    await f.start();const first=f.players[0],second=f.players[2];
    const rounds=[["Sandwiches","Blanket","Water","Fruit","Napkins"],["Flowers","Trees","Birds","Vegetables","Butterflies"],["Board games","Movies","Reading","Baking","Puzzles"]];
    for(const answers of rounds){
      await first.getByRole("button",{name:"BUZZ!",exact:true}).click();
      for(const text of answers){await first.getByLabel("Your team's answer",{exact:true}).fill(text);await first.getByRole("button",{name:"Send answer",exact:true}).click();await expect(first.locator(".feud-decision")).toContainText(`${text} revealed`);}
      await expect(f.host.locator("#heading")).toContainText("reveal");await f.host.getByRole("button",{name:"Next",exact:true}).click();
    }
    await f.host.getByRole("button",{name:"Start lightning timer",exact:true}).click();
    for(const [index,text] of ["yellow curved fruit","Bird","Orange juice","Swing","Zebra"].entries()){
      await first.getByLabel("Your quick answer",{exact:true}).fill(text);await first.getByRole("button",{name:"Lock answer",exact:true}).click();
      if(index<4)await expect(first.locator(".feud-controller")).toContainText(`Question ${index+2} of 5`);
    }
    await expect(second.locator("#content")).not.toContainText("yellow curved fruit");
    await f.host.getByRole("button",{name:"Start lightning timer",exact:true}).click();
    await second.getByLabel("Your quick answer",{exact:true}).fill("Lemon");await second.getByRole("button",{name:"Lock answer",exact:true}).click();
    await expect(second.locator(".feud-controller")).toContainText("Question 2 of 5");
    await second.getByLabel("Your quick answer",{exact:true}).fill("Bird");await second.getByRole("button",{name:"Lock answer",exact:true}).click();
    await expect(second.locator("#status")).toContainText("used by the first finalist");await expect(second.getByLabel("Your quick answer",{exact:true})).toHaveValue("Bird");
    for(const [index,text] of ["Airplane","Milk","Slide","Tiger"].entries()){
      await second.getByLabel("Your quick answer",{exact:true}).fill(text);await second.getByRole("button",{name:"Lock answer",exact:true}).click();
      if(index<3)await expect(second.locator(".feud-controller")).toContainText(`Question ${index+3} of 5`);
    }
    await expect(f.host.locator(".feud-controller")).toContainText("Both runs are locked");await expect(second.locator("#content")).not.toContainText("yellow curved fruit");
    await f.host.getByText("Private host controls",{exact:true}).click();await f.host.getByLabel("Match run 1, question 1",{exact:true}).selectOption("0");
    await expect(f.host.locator(".feud-review-question").first()).toContainText("yellow curved fruit · 40 points");
    await f.host.reload();await expect(f.host.locator(".feud-review-question").first()).toContainText("yellow curved fruit · 40 points");
    await f.host.getByRole("button",{name:"Publish lightning results",exact:true}).click();await expect(first.locator(".feud-final-results")).toContainText("350 / 200 points");
    await f.host.getByRole("button",{name:"Next",exact:true}).click();await expect(first.locator("#heading")).toContainText("finished");await expect(first.locator("#roster")).toContainText("Guest 0: 950 points");await noOverflow(first);
  } finally {await f.close();}
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
    await artist.getByRole("button",{name:"Pen tools",exact:true}).click();
    await expect(artist.getByLabel("Pen color", {exact:true})).toBeVisible();
    await artist.getByRole("button",{name:"Back to game",exact:true}).click();
    const pad = artist.locator(".doodle-pad");
    await expect(pad).toBeVisible();
    await pad.scrollIntoViewIfNeeded();
    const box = await pad.boundingBox();
    expect(box).toBeTruthy();
    await artist.mouse.move(box.x + 20, box.y + 20);
    await artist.mouse.down();
    await artist.mouse.move(box.x + 80, box.y + 90, { steps: 5 });
    await artist.mouse.up();
    await expect.poll(() => guesser.locator(".doodle-pad path").count()).toBeGreaterThan(0);
    await expect(artist.locator(".doodle-pad")).toHaveAttribute("aria-disabled", "false");
    const drawnSegments = await guesser.locator(".doodle-pad path").count();
    await pad.focus();
    await artist.keyboard.press("ArrowRight");
    await artist.keyboard.press("Enter");
    await expect(guesser.locator(".doodle-pad path")).toHaveCount(drawnSegments + 1);
    await expect(pad).toBeFocused();
    await artist.keyboard.press("ArrowRight");
    await artist.keyboard.press("Enter");
    await expect(guesser.locator(".doodle-pad path")).toHaveCount(drawnSegments + 2);
    const keyboardLines=await guesser.locator(".doodle-pad path").evaluateAll(lines=>lines.slice(-2).map(line=>line.getAttribute("d")));
    expect(keyboardLines).toEqual(["M 500 500 L 530 500","M 530 500 L 560 500"]);
    await artist.reload();
    await expect(artist.locator(".doodle-pad path")).toHaveCount(drawnSegments + 2);
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
    expect((await p.locator(".card-hand:visible").first().boundingBox()).height).toBeLessThan(400);
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

test("Guided poker: private hands, betting, card exchange, automatic payout and next hand", async ({ browser }) => {
  const f = await lobby(browser, "table");
  try {
    await f.start();
    const [other, first] = f.players;
    await expect(first.locator(".poker-hand .poker-card")).toHaveCount(5);
    await expect(first.locator(".poker-table-details")).not.toHaveAttribute("open");
    await expect(first.locator(".poker-controller")).toBeVisible();
    await expect(first.locator(".poker-table-details")).not.toBeVisible();
    await expect(f.host.locator(".poker-hand")).toHaveCount(0);
    await expect(f.host.locator(".poker-revealed")).toHaveCount(0);
    await expect(first.getByRole("button", {name:"Roll two dice"})).toHaveCount(0);
    await first.getByRole("button", {name:"Bet · add 10 chips",exact:true}).click();
    await other.getByRole("button", {name:"Call 10 chips",exact:true}).click();
    await expect(first.getByRole("button", {name:"Stand pat (keep all 5)",exact:true})).toBeVisible();
    const old = await first.locator(".poker-hand .poker-card").allTextContents();
    await first.locator(".poker-hand button").first().click();
    await first.getByRole("button", {name:"Replace 1 selected cards",exact:true}).click();
    await expect(first.locator(".poker-hand .poker-card")).not.toHaveText(old);
    await other.getByRole("button", {name:"Stand pat (keep all 5)",exact:true}).click();
    await first.getByRole("button", {name:"Check",exact:true}).click();
    await other.getByRole("button", {name:"Check",exact:true}).click();
    await expect(f.host.locator("#content")).toContainText("Pots were awarded automatically");
    await expect(f.host.locator(".poker-revealed .poker-card")).toHaveCount(10);
    await expect(f.host.locator(".poker-pot")).toContainText("Pot: 0 play chips");
    await first.reload();
    await expect(first.locator(".poker-hand .poker-card")).toHaveCount(5);
    await noOverflow(first);
    await f.host.getByRole("button", {name:"Next poker hand",exact:true}).click();
    await expect(f.host.locator("#content")).toContainText("Hand 2 of 5");
    await expect(f.host.locator(".poker-revealed")).toHaveCount(0);
  } finally { await f.close(); }
});

test("Whist remains a manual private-hand table with host-controlled pot awards", async ({ browser }) => {
  const f = await lobby(browser, "table", 4);
  try {
    await f.host.getByLabel("Card-table preset").selectOption("whist");
    await f.start();
    const p=f.players[0];
    await expect(p.locator(".card-hand .standard-card")).toHaveCount(13);
    await p.getByRole("button",{name:"Game info",exact:true}).click();
    await p.getByLabel("Play chips to add to pot").fill("10");
    await p.getByRole("button",{name:"Add chips to pot",exact:true}).click();
    await expect(f.host.locator("#content")).toContainText("Pot: 10 play chips");
    await f.host.getByRole("button",{name:"Award pot to selected player",exact:true}).click();
    await expect(f.host.locator("#content")).toContainText("Pot: 0 play chips");
    await p.getByRole("button",{name:"Back to game",exact:true}).click();
    await noOverflow(p);
  } finally { await f.close(); }
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

test("Credits offer exact guest source, pinned upstream records and license notices", async ({
  page,
  request,
}) => {
  await page.goto(base + "/sources.html");
  const creditsResponse = await request.get(base + "/open-source/credits.json");
  expect(creditsResponse.ok()).toBe(true);
  const credits = await creditsResponse.json();
  expect(credits.sources).toHaveLength(11);
  await expect(page.locator("#source-list article")).toHaveCount(credits.sources.length + 1);
  for (const record of credits.sources) {
    await expect(page.locator(`#source-list a[href="./open-source/${record.id}.txt"]`)).toHaveCount(1);
  }
  const response = await request.get(base + "/open-source/source.json");
  expect(response.ok()).toBe(true);
  const source = await response.json();
  expect(
    source.files.some((f) => f.path.endsWith("open-pack/board-rules.js")),
  ).toBe(true);
  expect(source.files.some((f) => /\.env/.test(f.path))).toBe(false);
  expect(source.files.some((f) => f.path.endsWith("public/race-math.js"))).toBe(true);
  expect(source.files.some((f) => f.path.endsWith("public/race-ui.js"))).toBe(true);
  expect((await request.get(base + "/open-source/boards.txt")).ok()).toBe(true);
  expect((await request.get(base + "/open-source/race.txt")).ok()).toBe(true);
  expect((await request.get(base + "/open-source/phone-controllers.txt")).ok()).toBe(true);
  expect((await request.get(base + "/open-source/three.txt")).ok()).toBe(true);
  expect((await request.get(base + "/open-source/race-3d-reference.txt")).ok()).toBe(true);
  expect(source.files.some(f => f.path.endsWith("render/race-3d-scene.js"))).toBe(true);
  expect(source.files.some(f => f.path.endsWith("script/build-race-renderer.mjs"))).toBe(true);
});


test("Game categories keep all 31 modes easy to browse", async ({page}) => {
  await page.goto(base);
  await expect(page.locator(".pick-game-card:visible")).toHaveCount(31);
  await page.getByRole("button",{name:"Cards & dice",exact:true}).click();
  await expect(page.locator(".pick-game-card:visible")).toHaveCount(2);
  await expect(page.locator('[data-game="colors"]')).toBeVisible();
  await page.getByRole("button",{name:"Board games",exact:true}).click();
  await expect(page.locator(".pick-game-card:visible")).toHaveCount(7);
  await expect(page.locator('[data-game="homeward"]')).toBeVisible();
  await page.getByRole("button",{name:"Party & trivia",exact:true}).click();
  await expect(page.locator(".pick-game-card:visible")).toHaveCount(17);
  await expect(page.locator('[data-game="no-say"]')).toBeVisible();
  await expect(page.locator('[data-game="trails"]')).toBeHidden();
  await page.getByRole("button",{name:"Racing & arcade",exact:true}).click();
  await expect(page.locator(".pick-game-card:visible")).toHaveCount(5);
  await expect(page.locator('[data-game="trails"]')).toBeVisible();
  await expect(page.locator('[data-game="tap"]')).toBeVisible();
  await expect(page.locator('[data-game="race"]')).toBeVisible();
  await page.getByRole("button",{name:"All games",exact:true}).click();
  await expect(page.locator(".pick-game-card:visible")).toHaveCount(31);
});

test("Drawing waits for a slow submission instead of showing a stroke that was never sent", async ({browser}) => {
  const f=await lobby(browser,"draw");
  try {
    await f.start();
    const [artist,guesser]=f.players;
    await artist.locator(".open-game button").first().click();
    await artist.getByRole("button",{name:"Pen tools",exact:true}).click();
    await expect(artist.getByLabel("Pen color",{exact:true})).toBeVisible();
    await artist.getByRole("button",{name:"Back to game",exact:true}).click();
    await artist.evaluate(()=>{
      const send=WebSocket.prototype.send, seen=new Set();
      window.__heldStrokes=[]; window.__drawingReleased=false;
      WebSocket.prototype.send=function(raw){
        const msg=JSON.parse(raw);
        if(msg.type==="play"&&msg.value?.action==="stroke"&&!window.__drawingReleased){
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
    await expect(guesser.locator(".doodle-pad path")).toHaveCount(0);
    await artist.evaluate(()=>{window.__drawingReleased=true;window.__heldStrokes.shift()();});
    await expect(pad).toHaveAttribute("aria-disabled","false");
    const committed=await guesser.locator(".doodle-pad path").count();
    expect(committed).toBeGreaterThan(0);
    expect(await guesser.locator(".doodle-pad path").evaluateAll(lines=>new Set(lines.map(line=>line.dataset.strokeId)).size)).toBe(1);
    await artist.reload();
    await expect(artist.locator(".doodle-pad path")).toHaveCount(committed);
  } finally { await f.close(); }
});


test("Doodle Dash streams while drawing, preserves tools, groups undo/redo and explains a correct guess", async ({ browser }) => {
  const f=await lobby(browser,"draw",3);
  try {
    await f.start();
    const [artist,guesser,last]=f.players;
    const word=await artist.locator(".open-game button").first().innerText();
    await artist.getByRole("button",{name:word,exact:true}).click();
    await artist.setViewportSize({width:320,height:780});
    await artist.getByRole("button",{name:"Pen tools",exact:true}).click();
    await artist.getByLabel("Pen color",{exact:true}).selectOption("#2477db");
    await artist.getByLabel("Pen width",{exact:true}).selectOption("16");
    await artist.getByRole("button",{name:"Back to game",exact:true}).click();
    const pad=artist.locator(".doodle-pad");
    await pad.scrollIntoViewIfNeeded();
    const box=await pad.boundingBox();
    await artist.mouse.move(box.x+25,box.y+25);await artist.mouse.down();
    for(let i=1;i<=8;i++) {
      await artist.mouse.move(box.x+25+i*12,box.y+25+i*10);
      await artist.waitForTimeout(90);
    }
    await expect.poll(()=>guesser.locator(".doodle-pad path").count()).toBeGreaterThan(0);
    await artist.mouse.up();
    await expect(pad).toHaveAttribute("aria-disabled","false");
    const segments=await guesser.locator(".doodle-pad path").count();
    await expect(artist.getByLabel("Pen color",{exact:true})).toHaveValue("#2477db");
    await expect(artist.getByLabel("Pen width",{exact:true})).toHaveValue("16");
    await artist.getByRole("button",{name:"Undo stroke",exact:true}).click();
    await expect(guesser.locator(".doodle-pad path")).toHaveCount(0);
    await artist.getByRole("button",{name:"Redo stroke",exact:true}).click();
    await expect(guesser.locator(".doodle-pad path")).toHaveCount(segments);
    await artist.reload();
    await expect(artist.getByLabel("Pen color",{exact:true})).toHaveValue("#2477db");
    await expect(artist.getByLabel("Pen width",{exact:true})).toHaveValue("16");
    await noOverflow(artist);
    await guesser.getByLabel("Guess the drawing").fill(word);
    await guesser.getByRole("button",{name:"Submit",exact:true}).click();
    await expect(guesser.locator("#content")).toContainText("You guessed it!");
    await expect(guesser.getByLabel("Guess the drawing")).toHaveCount(0);
    await expect(last.locator("#content")).not.toContainText(`Your private word: ${word}`);
    await last.getByLabel("Guess the drawing").fill(word);
    await last.getByRole("button",{name:"Submit",exact:true}).click();
    await expect(f.host.locator("#heading")).toContainText("reveal");
    await f.host.getByRole("button",{name:"Next",exact:true}).click();
    await expect(guesser.getByRole("heading",{name:"Choose your secret word",exact:true})).toBeVisible();
  } finally { await f.close(); }
});
