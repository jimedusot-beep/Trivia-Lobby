import { test, expect } from "@playwright/test";

test("home opens straight to guest play and learn, without an account", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Play together. Learn for fun." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start a Party/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Try a Lesson/ })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByLabel(/Password/)).toHaveCount(0);
  await page.getByRole("link", { name: /Try a Lesson/ }).click();
  await expect(page.getByRole("heading", { name: "Learn something today" })).toBeVisible();
});

test("guest completes a lesson without login and retains local XP on refresh", async ({ page }) => {
  await page.goto("/learn-demo");
  await expect(page.getByRole("heading", { name: "Learn something today" })).toBeVisible();
  for (const answer of ["A. Roots", "B. 0°C", "C. Mars"]) {
    await page.getByRole("button", { name: answer, exact: true }).click();
    await expect(page.getByRole("status").last()).toContainText("Correct!");
    const final = answer.includes("Mars");
    await page.getByRole("button", { name: final ? "Finish lesson" : "Next question" }).click();
  }
  await expect(page.getByRole("heading", { name: "Lesson complete!" })).toBeVisible();
  await expect(page.getByText("You answered 3 of 3 correctly.")).toBeVisible();
  await expect(page.getByText("30 practice XP")).toBeVisible();
  await page.reload();
  await expect(page.getByText("30 practice XP")).toBeVisible();
  await expect(page.getByRole("button", { name: /Science Starter/ })).toContainText("Completed");
  await expect(page.getByRole("heading", { name: "Learn something today" })).toBeVisible();
});

test("public guest party loads, while private deck APIs stay protected", async ({ page, request }) => {
  await page.goto("/party/");
  await expect(page.getByRole("heading", { name: "One code. Everyone plays." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create host screen" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  const privateDecks = await request.get("/api/decks");
  expect(privateDecks.status()).toBe(401);
  await page.goto("/decks");
  await expect(page.getByRole("heading", { name: "Sign in to your study library" })).toBeVisible();
});
