import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const scienceAnswers = ["A. Raíces", "B. 0°C", "C. Marte"];
async function answerLesson(page: import("@playwright/test").Page, answers: string[]) {
  for (let index = 0; index < answers.length; index++) {
    await page.getByRole("button", { name: answers[index], exact: true }).click();
    await expect(page.getByRole("status").last()).toContainText("¡Correcto!");
    await page.getByRole("button", { name: index === answers.length - 1 ? "Terminar lección" : "Siguiente pregunta", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "¡Lección completada!", exact: true })).toBeVisible();
}

test("sample lessons: all three Spanish lessons preserve IDs, completion and replay XP", async ({ page }) => {
  await page.goto("/learn-demo?lang=es");
  await expect(page.locator("main")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { name: "Aprende algo hoy", exact: true })).toBeVisible();
  const lessons = [
    { title: "Primeros pasos en ciencias", answers: scienceAnswers },
    { title: "El mundo de las palabras", answers: ["B. Gigantesco", "A. ¿Dónde está el libro?", "C. Moderno"] },
    { title: "La vuelta al mundo", answers: ["B. Pacífico", "C. América del Sur", "A. Tokio"] },
  ];
  for (const [index, lesson] of lessons.entries()) {
    await page.getByRole("button", { name: new RegExp(lesson.title) }).click();
    await answerLesson(page, lesson.answers);
    await expect(page.getByText("Has acertado 3 de 3 preguntas.", { exact: true })).toBeVisible();
    await expect(page.getByText(`${(index + 1) * 30} XP de práctica`, { exact: true })).toBeVisible();
  }
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem("trivia-lobby-guest-learning-v1") || "[]"))).toEqual(["science", "words", "geography"]);
  await page.getByRole("button", { name: "Intentar de nuevo", exact: true }).click();
  await answerLesson(page, lessons[2].answers);
  await expect(page.getByText("90 XP de práctica", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("90 XP de práctica", { exact: true })).toBeVisible();
});

test("sample lessons: changing language keeps the selected answer and actual score", async ({ page }) => {
  await page.goto("/learn-demo");
  await page.getByRole("button", { name: "B. Leaves", exact: true }).click();
  const language = page.getByRole("combobox", { name: "Language / Idioma", exact: true });
  for (const locale of ["es", "en", "es"]) {
    await language.focus(); await language.selectOption(locale); await expect(language).toBeFocused();
    await expect(page.locator(".sample-answers button:disabled")).toHaveCount(3);
    await expect(page.getByRole("status").last()).toContainText(locale === "es" ? "¡Buen intento! Esta es la respuesta." : "Good try! Here's the answer.");
  }
  await page.getByRole("button", { name: "Siguiente pregunta", exact: true }).click();
  await page.getByRole("button", { name: "B. 0°C", exact: true }).click();
  await page.getByRole("button", { name: "Siguiente pregunta", exact: true }).click();
  await page.getByRole("button", { name: "C. Marte", exact: true }).click();
  await page.getByRole("button", { name: "Terminar lección", exact: true }).click();
  await expect(page.getByText("Has acertado 2 de 3 preguntas.", { exact: true })).toBeVisible();
  await language.selectOption("en");
  await expect(page.getByText("You answered 2 of 3 correctly.", { exact: true })).toBeVisible();
  await language.selectOption("es"); await page.reload();
  await expect(page.locator("main")).toHaveAttribute("lang", "es");
  await expect(page.getByText("30 XP de práctica", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Primeros pasos en ciencias/ })).toContainText("Completada");
});

test("sample lessons: blocked storage reports session-only progress in either language", async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException("Synthetic storage denial", "SecurityError"); }; });
  await page.goto("/learn-demo");
  await expect(page.getByRole("status").first()).toHaveText("Progress is available for this session, but this browser couldn't save it.");
  await page.getByRole("combobox", { name: "Language / Idioma", exact: true }).selectOption("es");
  await expect(page.getByRole("status").first()).toHaveText("Tu progreso está disponible en esta sesión, pero el navegador no pudo guardarlo.");
  await answerLesson(page, scienceAnswers);
  await expect(page.getByText("Este progreso dura solo durante la sesión actual.")).toBeVisible();
  await expect(page.getByText("Esta lección se ha guardado como completada en este dispositivo.")).toHaveCount(0);
  await expect(page.getByText("30 XP de práctica", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("0 practice XP", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Science Starter/ })).not.toContainText("Completed");
});

test("sample lessons: Spanish phone controls and feedback remain accessible", async ({ page }) => {
  await page.goto("/learn-demo?lang=es");
  await expect(page).toHaveTitle("Lecciones de muestra · Trivia Lobby");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect(page.getByRole("progressbar", { name: "Progreso de la lección", exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "A. Raíces", exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("spanish-sample-feedback.png"), fullPage: true });
});
