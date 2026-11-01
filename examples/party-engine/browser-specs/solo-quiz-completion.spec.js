import { test, expect } from "@playwright/test";

// Complete an actual five-round Quiz from the single Solo Test tab, with
// ordinary server-owned turns and the two automatically answering guest seats.
// This exercises the real host/guest connections rather than a mocked reducer.
test("completion: solo Trivia Quiz scores five rounds and returns to the same room", async ({ page, context }) => {
  test.setTimeout(150000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/solo-test.html");
  await page.locator("#solo-mode").selectOption("quiz");
  await page.locator("#solo-seats").selectOption("3");
  await page.locator("#solo-start").click();

  await expect(page.locator("#solo-players li")).toHaveCount(3, { timeout: 25000 });
  await expect(page.locator("#solo-phase")).toContainText("question", { timeout: 25000 });
  const room = (await page.locator("#solo-room").innerText()).trim();
  expect(room).toMatch(/Temporary test room: [A-HJ-NP-Z2-9]{6}/);
  expect(context.pages()).toHaveLength(1);

  let previousTotal = 0;
  for (let round = 1; round <= 5; round++) {
    await expect(page.locator("#solo-phase")).toContainText("question", { timeout: 15000 });
    await expect(page.locator("#solo-phase")).toContainText("Round " + round);
    const controls = page.locator("#solo-controls button");
    await expect(controls).toHaveCount(4, { timeout: 15000 });
    await expect(controls.first()).toBeEnabled();
    await controls.first().click();
    await expect(page.locator("#solo-phase")).toContainText("reveal", { timeout: 15000 });
    await expect(page.locator("#solo-players li")).toHaveCount(3);
    const scores = await page.locator("#solo-players li").allTextContents();
    const total = scores.reduce((sum, label) => {
      const points = label.match(/— (\d+) points/);
      expect(points, "score on each player row").not.toBeNull();
      return sum + Number(points[1]);
    }, 0);
    expect(total).toBeGreaterThanOrEqual(previousTotal);
    expect(total).toBeLessThanOrEqual(round * 300);
    previousTotal = total;
    await page.getByRole("button", { name: "Next round", exact: true }).click();
  }

  await expect(page.locator("#solo-phase")).toContainText("finished", { timeout: 15000 });
  await expect(page.locator("#solo-room")).toHaveText(room);
  await expect(page.locator("#solo-players li")).toHaveCount(3);
  await page.getByRole("button", { name: "Back to lobby", exact: true }).click();
  await expect(page.locator("#solo-phase")).toContainText("lobby", { timeout: 15000 });
  await expect(page.locator("#solo-room")).toHaveText(room);
  expect(context.pages()).toHaveLength(1);
  expect(errors).toEqual([]);

  await page.getByRole("button", { name: "Stop test" }).click();
  await expect(page.locator("#solo-stage")).toBeHidden();
  await expect(page.getByRole("button", { name: "Start solo test" })).toBeEnabled();
});
