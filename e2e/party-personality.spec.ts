import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function ready(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, image => image.complete ? Promise.resolve() : new Promise(resolve => {
      image.onload = image.onerror = resolve;
    })));
  });
  expect(await page.evaluate(() => Array.from(document.images).every(image => image.naturalWidth > 0))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function shot(page: Page, name: string) {
  await ready(page);
  await page.screenshot({ path: test.info().outputPath(name + ".png"), fullPage: true, animations: "disabled" });
}
const quiz = { format: "trivia-lobby-local-quiz", version: 1, deck: {
  title: "Color Club", questions: [{ prompt: "Which color mixes with blue to make green?",
    choices: ["Yellow", "Red", "Purple", "Pink"], correct: 0, explanation: "Blue and yellow pigments mix to make green." }],
} };
async function create(page: Page) {
  await page.goto("/party/create.html");
  await page.locator("#import-file").setInputFiles({ name: "color-club.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(quiz)) });
  await expect(page.locator("#status")).toContainText("Imported 1 questions");
}

test("clubhouse identity fits phone and desktop, ships local fonts, and keeps public pages accessible", async ({ page }) => {
  test.setTimeout(150000);
  const externalFonts: string[] = [], errors: string[] = [];
  page.on("request", request => { if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) externalFonts.push(request.url()); });
  page.on("pageerror", error => errors.push(error.message));
  const routes = [["/", "home"], ["/party/", "party"], ["/party/create.html", "creator"], ["/party/learn.html", "courses"], ["/learn-demo", "sample"]];
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    for (const [route, name] of routes) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator(".lobby-brand").first()).toBeVisible();
      await expect(page.locator("h1")).toHaveCSS("font-family", /Fredoka/);
      await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
      await shot(page, `lobby-${name}-${width}`);
      if (width === 390) expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  }
  expect(externalFonts).toEqual([]); expect(errors).toEqual([]);
});

test("learning celebrations finish, and reduced motion preserves calm keyboard practice", async ({ page }) => {
  await create(page);
  await page.getByRole("button", { name: "Save & learn", exact: true }).click();
  await page.locator("#daily").click();
  await page.getByRole("button", { name: "A. Yellow", exact: true }).click();
  await expect(page.locator("#continue")).toBeFocused();
  await shot(page, "lobby-learning-feedback");
  await page.locator("#continue").click();
  await expect(page.locator("#summary")).toBeVisible();
  await expect(page.locator(".lobby-confetti")).toHaveCount(1);
  await expect(page.locator(".lobby-confetti")).toHaveCount(0, { timeout: 4000 });
  await shot(page, "lobby-learning-win");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#replay").click();
  await page.getByRole("button", { name: "A. Yellow", exact: true }).click();
  await page.locator("#continue").press("Enter");
  await expect(page.locator("#summary-heading")).toBeFocused();
  await expect(page.locator(".lobby-confetti")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("party tiles, scores and the final celebration retain the real three-player quiz flow", async ({ page, browser }) => {
  test.setTimeout(90000);
  await create(page);
  await page.getByRole("button", { name: "Save & host this quiz", exact: true }).click();
  await expect(page.locator("#status")).toHaveText("Connected.");
  await page.getByRole("button", { name: "Create host screen", exact: true }).click();
  await expect(page.locator("#heading")).toContainText("lobby");
  const code = (await page.locator("#heading").innerText()).split(" · ")[0];
  const contexts = [];
  try {
    const players = [];
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); contexts.push(context);
      const player = await context.newPage(); await player.goto("/party/");
      await expect(player.locator("#status")).toHaveText("Connected.");
      await player.getByLabel("Party code", { exact: true }).fill(code);
      await player.getByLabel("Nickname", { exact: true }).fill("Color Crew " + i);
      await player.getByRole("button", { name: "Join party", exact: true }).click();
      await expect(player.locator("#heading")).toContainText("lobby"); players.push(player);
    }
    await shot(page, "lobby-host-room");
    await page.getByRole("button", { name: "Start match", exact: true }).click();
    await expect(players[0].getByRole("button", { name: "Yellow", exact: true })).toBeVisible();
    await shot(players[0], "lobby-player-question-phone");
    expect((await new AxeBuilder({ page: players[0] }).analyze()).violations).toEqual([]);
    for (const player of players) await player.getByRole("button", { name: "Yellow", exact: true }).click();
    await expect(page.locator("#heading")).toContainText("reveal");
    await expect(page.locator("#roster")).toContainText("100 points");
    await shot(page, "lobby-host-reveal");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator("#heading")).toContainText("finished");
    await expect(page.getByRole("button", { name: "Return to same party", exact: true })).toBeVisible();
    await shot(page, "lobby-party-win");
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
