import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("the clubhouse and party lobby share the device's English/Spanish identity", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#welcome-title")).toContainText("Play together.");
  await page.getByRole("combobox", { name: "Language / Idioma", exact: true }).selectOption("es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("main")).toHaveAttribute("lang", "es");
  await expect(page.locator("#welcome-title")).toContainText("Juega en compañía.");
  await expect(page.locator(".bilingual-identity-line")).toHaveText("Dos idiomas. Una fiesta.");
  await expect(page).toHaveTitle("Trivia Lobby — Juega y aprende en compañía");
  await page.getByRole("link", { name: "Juegos en grupo", exact: true }).click();
  await expect(page.locator("#party-language")).toHaveValue("es");
  await expect(page.locator("#party-intro h1")).toHaveText("Un código. Todo el mundo juega.");
  await page.locator(".page-nav .lobby-brand").click();
  await expect(page.locator("#welcome-title")).toContainText("Juega en compañía.");
});

test("a language change preserves authored quiz text and marks its original wording", async ({ page }) => {
  await page.goto("/party/?lang=es");
  await page.getByRole("link", { name: "Crear cuestionario", exact: true }).click();
  // A URL hint is not a new global room setting; explicitly choose this device's preference.
  await page.locator("#display-language").selectOption("es");
  await expect(page.locator("main")).toHaveAttribute("lang", "es");
  await expect(page.locator(".language-content-note")).toContainText("conserva su texto original");
  const authored = "Preguntas de mamá — keep my exact wording";
  await page.locator("#quiz-title").fill(authored);
  await page.locator("#display-language").selectOption("en");
  await expect(page.locator("#quiz-title")).toHaveValue(authored);
  await page.locator("#display-language").selectOption("es");
  await expect(page.locator("#quiz-title")).toHaveValue(authored);
  await page.getByRole("link", { name: "Juegos en grupo", exact: true }).click();
  await expect(page.locator("#party-language")).toHaveValue("es");
});

test("Spanish phone layouts fit and another browser device stays English", async ({ browser }) => {
  const spanish = await browser.newContext({ viewport: { width: 320, height: 844 } });
  const english = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const es = await spanish.newPage(), en = await english.newPage();
    await es.goto("/"); await en.goto("/");
    await es.getByRole("combobox", { name: "Language / Idioma", exact: true }).selectOption("es");
    await expect(en.locator("html")).toHaveAttribute("lang", "en");
    for (const width of [320, 390]) {
      await es.setViewportSize({ width, height: 844 });
      expect(await es.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await es.goto("/party/");
    await expect(es.locator("#party-language")).toHaveValue("es");
    expect(await es.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await spanish.close(); await english.close(); }
});

test("Spanish identity surfaces keep accessible controls and language boundaries", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/"); await page.getByRole("combobox", { name: "Language / Idioma", exact: true }).selectOption("es");
  for (const route of ["/", "/party/", "/party/show.html", "/party/sources.html", "/learn-demo"]) {
    await page.goto(route);
    await expect(page.getByRole("combobox", { name: "Language / Idioma", exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations, route).toEqual([]);
    if (route === "/" || route === "/party/") await page.screenshot({ path: test.info().outputPath(route === "/" ? "spanish-welcome.png" : "spanish-party.png"), fullPage: true });
  }
  expect(errors).toEqual([]);
});
