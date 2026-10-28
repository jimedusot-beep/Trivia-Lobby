import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function addQuestion(page, prompt, correct) {
  await page.getByLabel("Question (200 characters max)").fill(prompt);
  await page.getByLabel("Answer A", { exact: true }).fill("Wrong answer");
  await page.getByLabel("Answer B", { exact: true }).fill("Right answer");
  await page.getByLabel("Correct answer").selectOption(String(correct));
  await page.getByRole("button", { name: "Add question" }).click();
}

test("create, refresh, export, delete and restore a local guest quiz without registration", async ({ page }) => {
  await page.goto("/create.html");
  await expect(page.getByRole("heading", { name: "Make your own quiz" })).toBeVisible();
  await page.getByLabel("Quiz title (80 characters max)").fill("Practice Night");
  await addQuestion(page, "Which answer is right?", 1);
  await page.getByRole("button", { name: "Save quiz on this device" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.reload();
  await expect(page.getByRole("button", { name: /Practice Night.*1 questions.*Edit/ })).toBeVisible();
  await page.getByRole("button", { name: /Practice Night.*1 questions.*Edit/ }).click();
  await expect(page.locator("#quiz-title")).toHaveValue("Practice Night");
  await expect(page.getByText("1. Which answer is right?")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON backup" }).click();
  const download = await downloadPromise;
  const file = await download.path();
  const bytes = await readFile(file);
  const json = JSON.parse(bytes.toString("utf8"));
  expect(json.version).toBe(1);
  expect(json.deck.questions[0].correct).toBe(1);
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: "Delete this quiz" }).click();
  await expect(page.getByText("No saved quizzes yet")).toBeVisible();
  await page.locator("#import-file").setInputFiles({
    name: "restored.json", mimeType: "application/json", buffer: bytes,
  });
  await expect(page.getByRole("status")).toContainText("Imported 1 questions");
  await expect(page.getByRole("button", { name: /Practice Night.*1 questions.*Edit/ })).toBeVisible();
});

test("host a custom local quiz for three guest players and show the true result", async ({ page, browser }) => {
  await page.goto("/create.html");
  await page.getByLabel("Quiz title (80 characters max)").fill("Play Our Quiz");
  await addQuestion(page, "Which answer is right?", 1);
  await page.getByRole("button", { name: "Save & host this quiz" }).click();
  await expect(page).toHaveURL(/\?deck=[\w-]+/);
  await expect(page.getByRole("heading", { name: "One code. Everyone plays." })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Connected.");
  await page.getByRole("button", { name: "Create host screen" }).click();
  await expect(page.getByText("Quiz (Play Our Quiz): 1 questions")).toBeVisible();
  const code = (await page.locator("#heading").innerText()).split(" · ")[0];
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

  const contexts = [];
  try {
    const players = [];
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      contexts.push(context);
      const player = await context.newPage();
      await player.goto("/");
      await expect(player.getByRole("status")).toHaveText("Connected.");
      await player.getByLabel("Party code").fill(code);
      await player.getByLabel("Nickname").fill("Learner " + i);
      await player.getByRole("button", { name: "Join party" }).click();
      await expect(player.locator("#heading")).toContainText("lobby");
      players.push(player);
    }
    await page.getByRole("button", { name: "Start match" }).click();
    await expect(players[0].locator(".phone-prompt")).toHaveText("Which answer is right?", { timeout: 10000 });
    await expect(players[0].getByText("Right answer ✓ Correct")).toHaveCount(0);
    await players[0].getByRole("button", { name: "Right answer" }).click();
    await players[1].getByRole("button", { name: "Wrong answer" }).click();
    await players[2].getByRole("button", { name: "Wrong answer" }).click();
    await expect(page.locator("#heading")).toContainText("reveal");
    await expect(page.getByText("Right answer ✓ Correct")).toBeVisible();
    await expect(page.locator("#roster")).toContainText("Learner 0: 100 points");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.locator("#heading")).toContainText("finished");
    await expect(page.getByText(/Leaders: Learner 0/)).toBeVisible();
  } finally {
    await Promise.all(contexts.map(c => c.close()));
  }
});

test("practice a custom quiz solo without account and see explanatory feedback", async ({ page }) => {
  await page.goto("/create.html");
  await page.getByLabel("Quiz title (80 characters max)").fill("Solo Stars");
  await addQuestion(page, "Which answer is right?", 1);
  await page.getByRole("button", { name: "Save & practice solo" }).click();
  await expect(page).toHaveURL(/\/practice\.html\?deck=/);
  await expect(page.getByRole("heading", { name: "Solo Stars" })).toBeVisible();
  await page.getByRole("button", { name: "B. Right answer" }).click();
  await expect(page.getByText("Correct!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show results" }).click();
  await expect(page.getByText(/You got 1 of 1 right/)).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Which answer is right?" })).toBeVisible();
});
