import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

async function language(page: Page, locale: string) { await page.locator("#display-language").selectOption(locale); }
async function question(page: Page, prompt = "Correct!", correct = "1") {
  await page.locator("#prompt").fill(prompt);
  await page.locator("#answer-a").fill("Roots"); await page.locator("#answer-b").fill("Mars");
  await page.locator("#correct").selectOption(correct);
  await page.locator("#explanation").fill("Private study library");
  await page.locator("#add-question").click();
}
async function downloadText(page: Page, id: string) {
  const pending = page.waitForEvent("download"); await page.locator(id).click();
  const path = await (await pending).path(); expect(path).toBeTruthy(); return readFile(path!, "utf8");
}

test("creator bilingual: Spanish editor preserves authored text and unsaved answer selection", async ({ page }) => {
  const privateRequests: string[] = []; page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) privateRequests.push(request.url()); });
  await page.goto("/party/create.html?lang=es");
  await expect(page.locator("main")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { name: "Crea tu propio cuestionario", exact: true })).toBeVisible();
  await expect(page.locator("#status")).toHaveText("Todo listo. Crea un cuestionario aquí abajo o abre uno que ya hayas guardado.");
  await page.locator("#quiz-title").fill("Home");
  await page.locator("#prompt").fill("Correct!"); await page.locator("#answer-a").fill("Roots"); await page.locator("#answer-b").fill("Mars");
  await page.locator("#correct").selectOption("1"); await page.locator("#explanation").fill("Private study library");
  for (const locale of ["en", "es"]) {
    await language(page, locale);
    await expect(page.locator("#quiz-title")).toHaveValue("Home"); await expect(page.locator("#prompt")).toHaveValue("Correct!");
    await expect(page.locator("#answer-a")).toHaveValue("Roots"); await expect(page.locator("#answer-b")).toHaveValue("Mars");
    await expect(page.locator("#correct")).toHaveValue("1"); await expect(page.locator("#explanation")).toHaveValue("Private study library");
  }
  await page.locator("#add-question").click(); await page.locator("#save-quiz").click();
  await expect(page.locator("#status")).toContainText('Se ha guardado "Home"');
  for (const locale of ["en", "es", "en", "es"]) await language(page, locale);
  await expect(page.locator("#saved-list li")).toHaveCount(1);
  const exported = JSON.parse(await downloadText(page, "#backup-quiz"));
  expect(exported).toEqual({ format: "trivia-lobby-local-quiz", version: 1, deck: { title: "Home", questions: [{ prompt: "Correct!", choices: ["Roots", "Mars"], correct: 1, explanation: "Private study library" }] } });
  await page.reload(); await page.locator("#saved-list button").click();
  await expect(page.locator("#quiz-title")).toHaveValue("Home"); await expect(page.locator("#question-list")).toContainText("Correct!");
  expect(privateRequests).toEqual([]);
});

test("creator bilingual: language changes retain edit mode and question order", async ({ page }) => {
  await page.goto("/party/create.html?lang=es"); await page.locator("#quiz-title").fill("Order test");
  await question(page, "First"); await question(page, "Second", "0");
  await page.getByRole("button", { name: "Editar pregunta 2", exact: true }).click();
  await page.locator("#prompt").fill("Second — unsaved edit");
  await language(page, "en"); await expect(page.locator("#form-heading")).toHaveText("Edit question 2");
  await expect(page.locator("#prompt")).toHaveValue("Second — unsaved edit"); await expect(page.locator("#correct")).toHaveValue("0");
  await language(page, "es"); await expect(page.locator("#add-question")).toHaveText("Actualizar pregunta");
  await page.locator("#add-question").click(); await page.getByRole("button", { name: "Subir pregunta 2", exact: true }).click();
  const deck = JSON.parse(await downloadText(page, "#backup-quiz")).deck;
  expect(deck.questions.map((q: {prompt: string}) => q.prompt)).toEqual(["Second — unsaved edit", "First"]);
  expect(deck.questions.map((q: {correct: number}) => q.correct)).toEqual([0, 1]);
  await page.getByRole("button", { name: "Eliminar pregunta 2", exact: true }).click(); await expect(page.locator("#count")).toHaveText("1 / 20");
});

test("creator bilingual: imports and exports retain Razzia scoring and canonical CSV headers", async ({ page }) => {
  await page.goto("/party/create.html?lang=es");
  const source = { subject: "Home", questions: [{ question: "Correct!", answers: ["Roots", "Mars"], solutions: [1], note: "Private study library", time: 17, maxPoints: 450, penalty: 50 }] };
  await page.locator("#import-file").setInputFiles({ name: "sample.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(source)) });
  await expect(page.locator("#status")).toContainText("Se ha importado 1 pregunta");
  await language(page, "en"); await language(page, "es");
  const exported = JSON.parse(await downloadText(page, "#backup-quiz"));
  expect(exported.deck.questions[0]).toEqual({ prompt: "Correct!", choices: ["Roots", "Mars"], correct: 1, explanation: "Private study library", seconds: 17, points: 450, penalty: 50 });
  const csv = await downloadText(page, "#csv-quiz");
  expect(csv.split("\r\n")[0]).toBe("Question,OptionA,OptionB,OptionC,OptionD,Correct,Explanation"); expect(csv).toContain('"Correct!","Roots","Mars","","","B","Private study library"');
  await page.locator("#import-file").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{broken") });
  await expect(page.locator("#status")).toHaveText("El archivo no contiene JSON válido.");
  await language(page, "en"); await expect(page.locator("#status")).toHaveText("This is not valid JSON.");
  await language(page, "es"); await expect(page.locator("#status")).toHaveText("El archivo no contiene JSON válido.");
  expect(JSON.parse(await downloadText(page, "#backup-quiz"))).toEqual(exported);
  await expect(page.locator("#saved-list li")).toHaveCount(1);
});

test("creator bilingual: required fields and indexed validation errors use the selected language", async ({ page }) => {
  await page.goto("/party/create.html?lang=es"); await page.locator("#add-question").click();
  await expect(page.locator("#status")).toHaveText("Completa los campos obligatorios antes de añadir la pregunta.");
  expect(await page.locator("#prompt").evaluate((node: HTMLTextAreaElement) => node.validationMessage)).toBe("Completa este campo.");
  await page.locator("#save-quiz").click(); await expect(page.locator("#status")).toHaveText("El título debe contener entre 1 y 80 caracteres imprimibles.");
  await page.locator("#quiz-title").fill("Validation"); await question(page, "Choose", "3");
  await expect(page.locator("#status")).toHaveText("Pregunta 1: elige la respuesta correcta.");
  await expect(page.locator("#prompt")).toHaveValue("Choose");
  await language(page, "en"); await expect(page.locator("#status")).toHaveText("Question 1: choose the correct answer.");
});

test("creator bilingual: unavailable device storage keeps the draft exportable without claiming a save", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(globalThis, "indexedDB", { get: () => undefined }));
  await page.goto("/party/create.html?lang=es"); await expect(page.locator("#status")).toHaveText("El almacenamiento del dispositivo no está disponible.");
  await page.locator("#quiz-title").fill("Unsaved Home"); await question(page);
  await page.locator("#save-quiz").click(); await expect(page.locator("#status")).toHaveText("El almacenamiento del dispositivo no está disponible.");
  expect(JSON.parse(await downloadText(page, "#backup-quiz")).deck.title).toBe("Unsaved Home");
  await expect(page.locator("#saved-list li")).toHaveCount(0);
});

test("creator bilingual: Spanish confirmations, phone layout and accessibility preserve authored titles", async ({ page }) => {
  await page.goto("/party/create.html?lang=es"); await page.locator("#quiz-title").fill("Home".repeat(20)); await question(page); await page.locator("#save-quiz").click();
  await expect(page.locator("#saved-list li")).toHaveCount(1);
  for (const width of [320, 390]) { await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const pending = page.waitForEvent("dialog"); const clicking = page.locator("#delete-quiz").click(); const dialog = await pending;
  expect(dialog.message()).toContain('¿Eliminar "' + "Home".repeat(20) + '"'); await dialog.dismiss(); await clicking;
  await expect(page.locator("#saved-list li")).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath("spanish-creator.png"), fullPage: true });
});
