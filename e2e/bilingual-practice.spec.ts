import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

async function author(page: Page, title = "Home", choices = ["Roots", "Mars"]) {
  await page.goto("/party/create.html"); await page.locator("#display-language").selectOption("es");
  await page.locator("#quiz-title").fill(title);
  for (const [index, prompt] of ["Correct!", "Second question"].entries()) {
    await page.locator("#prompt").fill(prompt);
    await page.locator("#answer-a").fill(choices[0]); await page.locator("#answer-b").fill(choices[1]);
    await page.locator("#correct").selectOption(index === 0 ? "1" : "0");
    await page.locator("#explanation").fill("Private study library"); await page.locator("#add-question").click();
  }
  await page.locator("#practice-quiz").click(); await expect(page).toHaveURL(/\/practice\.html\?deck=/);
  await expect(page.locator("#lesson")).toBeVisible();
}
async function locale(page: Page, language: string) {
  await page.locator("#display-language").focus(); await page.locator("#display-language").selectOption(language);
  await expect(page.locator("#display-language")).toBeFocused();
}
async function backup(page: Page) {
  const pending = page.waitForEvent("download"); await page.locator("#backup-quiz").click();
  const path = await (await pending).path(); expect(path).toBeTruthy(); return JSON.parse(await readFile(path!, "utf8"));
}

test("practice bilingual: feedback and completed results retain answers and score across languages", async ({ page }) => {
  await author(page);
  await expect(page.locator("main")).toHaveAttribute("lang", "es");
  await expect(page.locator("#title")).toHaveText("Home"); await expect(page.locator("#title")).toHaveAttribute("lang", "");
  await expect(page.locator("#prompt")).toHaveText("Correct!"); await expect(page.locator("#progress")).toHaveText("Pregunta 1 de 2");
  await page.getByRole("button", { name: "A. Roots", exact: true }).click(); await expect(page.locator("#next")).toBeFocused();
  for (const language of ["es", "en", "es"]) {
    await locale(page, language); await expect(page.locator("#choices button:disabled")).toHaveCount(2);
    await expect(page.locator("#result")).toHaveText(language === "es" ? "¡Buen intento!" : "Good try!");
    await expect(page.locator("#status")).toHaveText(language === "es" ? "Respuesta registrada. Continúa cuando quieras." : "Answer recorded. Continue when you are ready.");
    await expect(page.locator("#explanation")).toHaveText(language === "es" ? "La respuesta correcta es Mars. Private study library" : "Mars is correct. Private study library");
  }
  await page.locator("#next").click(); await expect(page.locator("#progress")).toHaveText("Pregunta 2 de 2");
  await page.getByRole("button", { name: "A. Roots", exact: true }).click(); await page.locator("#next").click();
  await expect(page.locator("#completed")).toBeVisible(); await expect(page.locator("#score")).toContainText("Has acertado 1 de 2 preguntas.");
  await locale(page, "en"); await expect(page.locator("#score")).toContainText("You got 1 of 2 right.");
  await locale(page, "es"); await expect(page.locator("#completed")).toBeVisible(); await expect(page.locator("#lesson")).toBeHidden();
  await page.locator("#again").click(); await expect(page.locator("#progress")).toHaveText("Pregunta 1 de 2");
  await page.getByRole("button", { name: "B. Mars", exact: true }).click(); await page.locator("#next").click();
  await page.getByRole("button", { name: "A. Roots", exact: true }).click(); await page.locator("#next").click();
  await expect(page.locator("#score")).toContainText("Has acertado 2 de 2 preguntas.");
});

test("practice bilingual: imported settings and authored content remain unchanged with no private history request", async ({ page }) => {
  const requests: string[] = []; page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url()); });
  await page.goto("/party/create.html?lang=es");
  const imported = { subject:"Home", questions:[{ question:"Correct!", answers:["Roots","Mars"], solutions:[1], note:"Private study library", time:17, maxPoints:450, penalty:50 }] };
  await page.locator("#import-file").setInputFiles({ name:"practice.json", mimeType:"application/json", buffer:Buffer.from(JSON.stringify(imported)) });
  await expect(page.locator("#status")).toContainText("Se ha importado 1 pregunta"); const before = await backup(page);
  await page.locator("#practice-quiz").click(); await expect(page.locator("#lesson")).toBeVisible();
  await locale(page,"en"); await page.getByRole("button", { name:"B. Mars", exact:true }).click();
  await locale(page,"es"); await page.locator("#next").click();
  await expect(page.locator("#score")).toContainText("Has acertado 1 de 1 pregunta.");
  await page.locator("#edit").click(); await expect(page.locator("#question-list li")).toHaveCount(1);
  expect(await backup(page)).toEqual(before); expect(requests).toEqual([]);
});

test("practice bilingual: missing quiz messages follow the selected language", async ({ page }) => {
  await page.goto("/party/practice.html?lang=es");
  await expect(page.locator("#status")).toHaveText("No se ha encontrado el cuestionario en este dispositivo. Abre Mis cuestionarios para buscarlo o importarlo.");
  await expect(page.locator("#lesson")).toBeHidden(); await expect(page.locator("#completed")).toBeHidden();
  await locale(page,"en"); await expect(page.locator("#status")).toHaveText("Quiz not found on this device. Open My quizzes to find or import it.");
  await locale(page,"es"); await expect(page.locator("#title")).toHaveText("Practica tu cuestionario");
});

test("practice bilingual: unavailable IndexedDB reports an error without exposing a practice round", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(globalThis,"indexedDB",{get:()=>undefined}));
  await page.goto("/party/practice.html?deck=synthetic-quiz-123&lang=es");
  await expect(page.locator("#status")).toHaveText("El almacenamiento del dispositivo no está disponible.");
  await expect(page.locator("#lesson")).toBeHidden(); await locale(page,"en");
  await expect(page.locator("#status")).toHaveText("Device storage is unavailable.");
});

test("practice bilingual: long authored text fits phones and keyboard feedback stays accessible", async ({ page }) => {
  await author(page,"Home".repeat(20),["Roots".repeat(24),"Mars".repeat(30)]);
  for (const width of [320,390]) { await page.setViewportSize({width,height:844}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); }
  await expect(page.locator("#prompt")).toBeFocused();
  await page.locator("#choices button").first().focus(); await page.keyboard.press("Enter"); await expect(page.locator("#next")).toBeFocused();
  await locale(page,"es"); expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.screenshot({path:test.info().outputPath("spanish-practice-feedback.png"),fullPage:true});
});
