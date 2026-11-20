import { test, expect } from "@playwright/test";

test("Spanish catalog search preserves canonical game IDs and the selected preview", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-game='draw'] .pick-game-preview-button").click();
  await page.locator("#party-language").selectOption("es");
  await expect(page.locator(".pick-game-grid")).toHaveAttribute("data-active-game", "draw");
  await expect(page.locator(".pick-game-spotlight h2")).toHaveText("Dibuja y adivina");
  await page.getByPlaceholder("Encuentra tu próximo juego").fill("Dibuja");
  await expect(page.locator("[data-game='draw']")).toBeVisible();
  await expect(page.locator(".pick-spotlight-language")).toContainText("inglés");
  await page.locator("#party-language").selectOption("en");
  await expect(page.locator(".pick-game-grid")).toHaveAttribute("data-active-game", "draw");
  await expect(page.locator(".pick-game-spotlight h2")).toHaveText("Doodle Dash");
});

test("all public tools retain the language preference and label content coverage", async ({ page }) => {
  await page.goto("/"); await page.locator("#party-language").selectOption("es");
  for (const path of ["create.html", "learn.html", "practice.html", "show.html", "solo-test.html", "sources.html", "open-party-lab.html"]) {
    await page.goto("/" + path);
    await expect(page.locator("#display-language")).toHaveValue("es");
    await expect(page.locator("main")).toHaveAttribute("lang", path === "create.html" ? "es" : "en");
    await expect(page.locator(".language-content-note")).toBeVisible();
    await expect(page.locator(".page-nav .lobby-language-signature")).toHaveText("English · Español");
  }
});
