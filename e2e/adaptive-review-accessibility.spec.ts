import { test, expect } from "@playwright/test";

// Exercise the real review UI with fixed API data so heading navigation is
// checked independently of database state, authentication and FSRS scheduling.
for (const width of [375, 1280]) {
  test(`adaptive prompts remain level-two headings at ${width}px`, async ({ page }) => {
    const base = process.env.BASE_URL ?? "http://127.0.0.1:5000";
    await page.setViewportSize({ width, height: 812 });
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (/^\/api\/(?:study\/)?auth\/me$/.test(path)) {
        await route.fulfill({ json: { id: "review-reader", email: "reader@example.com" } });
      } else if (path === "/api/study/queue") {
        await route.fulfill({ json: { cards: [
          { id: 1, front: "First recall prompt", back: "First answer", dueAt: null, needsWork: false },
          { id: 2, front: "Next recall prompt", back: "Next answer", dueAt: null, needsWork: false },
        ], totalMatching: 2 } });
      } else if (path === "/api/study/review") {
        await route.fulfill({ status: 201, json: {} });
      } else {
        await route.fulfill({ status: 404, json: { message: "Unexpected test request" } });
      }
    });
    await page.goto(base + "/learning/review/123?mode=due");
    await expect(page.getByRole("heading", { level: 2, name: "First recall prompt", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Reveal answer", exact: true }).click();
    await expect(page.getByText("First answer", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Next recall prompt", exact: true })).toBeVisible();
  });
}
