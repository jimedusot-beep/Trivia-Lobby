import { test, expect } from "@playwright/test";

// A whole game, not just a "Start match" or one-move smoke test.
// Every move uses the original authenticated seat controller and is scored
// by the actual server; no WebSocket or state mocks are used.
test("completion: Four in a Row plays to a winner, scores once, then returns to the same party", async ({ page, context }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/solo-test.html");
  await page.locator("#solo-mode").selectOption("four");
  await page.locator("#solo-seats").selectOption("2");
  await page.locator("#solo-start").click();

  const host = page.frameLocator("#solo-all-host-frame");
  const seats = [
    page.frameLocator("#solo-all-seat-frame-0"),
    page.frameLocator("#solo-all-seat-frame-1"),
  ];
  await expect(page.locator("#solo-status")).toContainText("is running with 2", { timeout: 35000 });
  await expect(page.locator("#solo-all-seat-switch option")).toHaveCount(2);
  await expect(host.locator("#heading")).toContainText("playing");
  expect(context.pages()).toHaveLength(1);

  // Four vertical discs in column 1 wins for Seat 1. The other player
  // independently makes three legal moves in column 2.
  for (let turn = 0; turn < 7; turn++) {
    const seatIndex = turn % 2;
    const column = seatIndex === 0 ? 1 : 2;
    await page.locator("#solo-all-seat-switch").selectOption(String(seatIndex));
    const control = seats[seatIndex].getByRole("button", { name: "Drop " + column, exact: true });
    await expect(control).toBeEnabled({ timeout: 12000 });
    await control.click();
    const discs = host.locator(
      ".four-cell[aria-label='" + (seatIndex === 0 ? "First player disc" : "Second player disc") + "']"
    );
    await expect(discs).toHaveCount(Math.ceil((turn + 1 - seatIndex) / 2), { timeout: 12000 });
  }

  await expect(host.locator("#heading")).toContainText("reveal", { timeout: 12000 });
  await expect(host.locator(".board-table")).toContainText("You wins!");
  await expect(host.locator("#roster")).toContainText("You: 100 points");
  await expect(host.locator("#roster")).toContainText("Test Seat 2: 0 points");
  // Finished board controls disappear in the revealed, read-only projection.
  // Assert no legal action is offered rather than expecting a disabled button
  // that does not exist in the completed game UI.
  await expect(seats[0].getByRole("button", { name: "Drop 1", exact: true })).toHaveCount(0);

  await host.getByRole("button", { name: "Next", exact: true }).click();
  await expect(host.locator("#heading")).toContainText("finished", { timeout: 12000 });
  await expect(host.locator("#content")).toContainText("Leaders: You");
  await expect(host.locator("#roster")).toContainText("You: 100 points");

  await host.getByRole("button", { name: "Return to same party", exact: true }).click();
  await expect(host.locator("#heading")).toContainText("lobby", { timeout: 12000 });
  await expect(host.getByRole("button", { name: "Start match", exact: true })).toBeVisible();
  await expect(page.locator("#solo-all-seat-switch option")).toHaveCount(2);
  expect(errors).toEqual([]);

  await page.locator("#solo-stop").click();
  await expect(page.locator("#solo-all-stage")).toBeHidden();
  await expect(page.locator("#solo-all-seat-frames iframe")).toHaveCount(0);
});

// Explicitly detect new, removed or renamed game IDs so coverage work
// cannot silently lag behind the authoritative 31-title catalog.
test("completion audit inventory matches every current party game", async ({ page }) => {
  const required = [
    "quiz", "duel", "charades", "majority", "likely", "closest",
    "survey", "impostor", "percentage", "category", "bingo", "caption",
    "timeline", "bracket", "turbo", "wave", "homeward", "trails",
    "no-say", "tap", "race", "feud", "draw", "colors", "four",
    "chess", "checkers", "reversi", "mancala", "table", "backgammon",
  ];
  await page.goto("/solo-test.html");
  const actual = await page.evaluate(async () => {
    const { guestGames } = await import("/game-catalog.js");
    return guestGames.map(game => game.id);
  });
  expect(new Set(required).size).toBe(31);
  expect([...actual].sort()).toEqual([...required].sort());
  const offered = await page.locator("#solo-mode option").evaluateAll(options => options.map(option => option.value));
  expect([...offered].sort()).toEqual([...required].sort());
});
