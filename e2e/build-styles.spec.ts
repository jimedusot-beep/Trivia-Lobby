import { test, expect, type Page } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";

async function builtStyles(page: Page) {
  const assets = new URL("../dist/public/assets/", import.meta.url);
  const styles = (await readdir(assets)).filter(name => name.endsWith(".css"));
  expect(styles.length).toBeGreaterThan(0);
  const css = (await Promise.all(styles.map(name => readFile(new URL(name, assets), "utf8")))).join("\n");
  await page.locator('style[data-vite-dev-id], link[rel="stylesheet"]').evaluateAll(nodes => nodes.forEach(node => node.remove()));
  await page.addStyleTag({ content: css });
}

// An external font provider is independent of the compiled application CSS.
test.beforeEach(async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
});

test("built styles preserve the join form, theme and keyboard focus on phone and desktop", async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/join");
    const code = page.getByLabel("Room Code", { exact: true });
    await expect(code).toBeVisible();
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
