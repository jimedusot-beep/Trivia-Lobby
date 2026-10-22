import { test, expect, type Page } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
const externalFonts = new WeakMap<Page, string[]>();

async function builtStyles(page: Page) {
  const assets = new URL("../dist/public/assets/", import.meta.url);
  const files = await readdir(assets);
  const styles = files.filter(name => name.endsWith(".css"));
  expect(styles.length).toBeGreaterThan(0);
  const css = (await Promise.all(styles.map(name => readFile(new URL(name, assets), "utf8")))).join("\n");
  // The dev server does not serve dist assets; load the exact built font bytes.
  await page.route("**/assets/*.woff2", async route => {
    const name = new URL(route.request().url()).pathname.split("/").pop()!;
    if (!files.includes(name)) return route.fallback();
    await route.fulfill({ contentType: "font/woff2", body: await readFile(new URL(name, assets)) });
  });
  await page.locator('style[data-vite-dev-id], link[rel="stylesheet"]').evaluateAll(nodes => nodes.forEach(node => node.remove()));
  await page.addStyleTag({ content: css });
  expect(await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('16px "Nunito Variable"') && document.fonts.check('16px "Fredoka Variable"');
  })).toBe(true);
}

test.beforeEach(async ({ page }) => {
  const requests: string[] = [];
  externalFonts.set(page, requests);
  page.on("request", request => { if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(request.url())) requests.push(request.url()); });
});
test.afterEach(async ({ page }) => { expect(externalFonts.get(page)).toEqual([]); });

test("built styles preserve the join form, theme and keyboard focus on phone and desktop", async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/join");
    const code = page.getByLabel("Room Code", { exact: true });
    await expect(code).toBeVisible();
    await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute("content", /maximum-scale|user-scalable=no/);
    // Exercise the shipped stylesheet as well as the Vite development pipeline.
    await builtStyles(page);

    const card = page.locator(".shadcn-card");
    const button = page.getByRole("button", { name: "Enter Game" });
    await expect(card).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(card).toHaveCSS("border-radius", "24px");
    await expect(code).toHaveCSS("height", "56px");
    await expect(code).toHaveCSS("border-top-width", "2px");
    await expect(button).toHaveCSS("height", "56px");
    await expect(button).toHaveCSS("font-size", "20px");
    await expect(button).toHaveCSS("border-radius", "12px");
    await expect(page.locator("body")).toHaveCSS("font-family", /Nunito/);

    const bounds = await card.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBe(Math.min(width - 32, 448));
    expect(Math.abs(bounds!.x + bounds!.width / 2 - width / 2)).toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await code.focus();
    await expect(code).toHaveCSS("outline-style", "solid");
    await expect(code).toHaveCSS("outline-width", "3px");
    await code.fill("ABC234");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Your Name", { exact: true })).toBeFocused();
    await page.keyboard.type("Styled player");
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    await expect(button).toBeEnabled();
    await expect(button).toHaveCSS("outline-width", "3px");
  }
});

test("built home styles keep the title gradient and actions visible across screen sizes", async ({ page }) => {
  await page.route("**/api/auth/me", route => route.fulfill({ json: { id: "layout-reader", email: "reader@example.test" } }));
  await page.route("**/api/decks", route => route.fulfill({ json: [] }));

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/");
    const title = page.getByRole("heading", { level: 1, name: "Trivia Lobby", exact: true });
    await expect(title).toBeVisible();
    await builtStyles(page);
    await expect(title).toHaveCSS("background-image", /linear-gradient/);
    await expect(title).toHaveCSS("color", "rgba(0, 0, 0, 0)");
    await expect(title).toHaveCSS("font-family", /Fredoka/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    for (const name of ["Join Game", "New Exam Deck", "Learning & memory", "Private source library", "Create Deck"]) {
      const action = page.getByRole("link", { name, exact: true }).first();
      await expect(action).toBeVisible();
      const bounds = await action.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("built learning styles wrap long account and study text without hiding actions", async ({ page }) => {
  const token = "W".repeat(100);
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { id: "layout-reader", email: "w".repeat(64) + "@example.test" } });
    if (path === "/api/study/dashboard") return route.fulfill({ json: {
      visual: { attempts: 0, correct: 0, due: 0 }, attempts: 1, correct: 0, accuracy: 0,
      sessions: 1, studyDays: 1, dueReviews: 1, studyStreak: 1, xp: 10, achievements: [], historyLimited: false,
      subjectProgress: [{ subject: token, attempts: 1, accuracy: 0, weakCards: 1, improvementPoints: null }],
      decks: [{ deckId: 1, title: "Source " + token, subject: token, total: 1, learned: 1, due: 1, mastered: 0, attempts: 1, correct: 0, accuracy: 0 }],
    } });
    if (path === "/api/study/history") return route.fulfill({ json: { wrongAnswers: [
      { id: "review", cardId: 1, deckId: 1, front: "Question " + token, subject: token, reviewedAt: "2026-10-22T12:00:00Z", rating: 1 },
    ] } });
    return route.fulfill({ status: 404, json: { message: "Unexpected test request" } });
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/learning");
  await expect(page.getByRole("heading", { name: "My learning", exact: true })).toBeVisible();
  await expect(page.getByText("Question " + token, { exact: true })).toBeVisible();
  await builtStyles(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const name of ["Review due", "Retry weak cards", "Study all", "Retry"]) {
    const action = page.getByRole("link", { name, exact: true });
    await expect(action).toBeVisible();
    const bounds = await action.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  }
});
