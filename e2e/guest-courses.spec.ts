import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("main app links to personal courses and ships guest learning without accessing private APIs", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "My courses", exact: true }).click();
  await expect(page).toHaveURL(/\/party\/learn.html/);
  await expect(page.getByRole("heading", { name: "A little progress, every day." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Make my first quiz" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const privateDecks = await request.get("/api/decks"); expect(privateDecks.status()).toBe(401);
  const files = await request.get("/api/library/files"); expect(files.status()).toBe(401);
  const assets = await request.get("/party/guest-learning.js");
  expect(assets.status()).toBe(200);
  expect(assets.headers()["content-security-policy"]).toContain("script-src 'self'");
  await page.getByRole("link", { name: "Make my first quiz" }).click();
  await page.locator("#import-file").setInputFiles({ name: "Learning.csv", mimeType: "text/csv",
    buffer: Buffer.from("Question,OptionA,OptionB,Correct\nWhich number is even?,Two,Three,A") });
  await expect(page.getByRole("status")).toContainText("Imported 1 questions");
  await page.getByRole("button", { name: "Save & learn", exact: true }).click();
  await page.getByRole("button", { name: "Start today’s lesson", exact: true }).click();
  await page.getByRole("button", { name: "A. Two", exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Finish lesson", exact: true }).click();
  await expect(page.locator("#xp")).toHaveText("15 practice XP");
  await page.reload(); await expect(page.locator("#xp")).toHaveText("15 practice XP");
  expect((await request.get("/api/decks")).status()).toBe(401);
});
