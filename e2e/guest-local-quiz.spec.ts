import { test, expect } from "@playwright/test";

test("public welcome offers Make a Quiz and local authoring never opens private deck APIs", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Make a Quiz" }).first()).toBeVisible();
  await page.getByRole("link", { name: "Make a Quiz" }).first().click();
  await expect(page).toHaveURL(/\/party\/create\.html$/);
  await expect(page.getByRole("heading", { name: "Make your own quiz" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByLabel(/Password/)).toHaveCount(0);
  await page.getByLabel("Quiz title (80 characters max)").fill("No Account Needed");
  await page.getByLabel("Question (200 characters max)").fill("What color is an orange?");
  await page.getByLabel("Answer A", { exact: true }).fill("Orange");
  await page.getByLabel("Answer B", { exact: true }).fill("Purple");
  await page.getByLabel("Correct answer").selectOption("0");
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("button", { name: "Save quiz on this device" }).click();
  await expect(page.getByRole("status")).toContainText('Saved "No Account Needed"');
  await page.reload();
  await page.getByRole("button", { name: /No Account Needed.*1 questions.*Edit/ }).click();
  await expect(page.getByText("1. What color is an orange?")).toBeVisible();
  const decks = await request.get("/api/decks");
  expect(decks.status()).toBe(401);
  await page.getByRole("button", { name: "Save & host this quiz" }).click();
  await expect(page).toHaveURL(/\/party\/\?deck=/);
  await expect(page.getByRole("heading", { name: "Pick a Game", level: 1 })).toBeVisible();
  await expect(page.locator(".pick-game-card")).toHaveCount(31);
});

test("invalid guest import cannot disclose or overwrite protected study data", async ({ page, request }) => {
  await page.goto("/party/create.html");
  await page.locator("#import-file").setInputFiles({
    name: "private.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ users: [{ email: "private@example.test" }], deck: { title: "Private" } })),
  });
  await expect(page.getByRole("status")).toContainText("Choose a Trivia Lobby local quiz JSON backup");
  const documents = await request.get("/api/library/files");
  expect(documents.status()).toBe(401);
});
