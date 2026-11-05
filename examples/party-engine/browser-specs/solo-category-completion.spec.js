import { test, expect } from "@playwright/test";

// Full game through the real host and three authenticated, manually switched
// player controllers in one browser tab. No mocked game state, artificial time
// advance, score patching, or early host stop.
const rounds = [
  { spanish: "piña", english: "pineapple", unique: "plátano" },
  { spanish: "camello", english: "camel", unique: "capibara" },
  { spanish: "berlín", english: "berlin", unique: "bogotá" },
  { spanish: "sopa", english: "soup", unique: "salchicha" },
  { spanish: "méxico", english: "mexico", unique: "malasia" },
];

test("completion: Category Clash finishes five bilingual duplicate-scored rounds and returns to the same room", async ({ page, context }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/solo-test.html");
  await page.locator("#solo-mode").selectOption("category");
  await page.locator("#solo-seats").selectOption("3");
  await page.locator("#solo-start").click();

  const host = page.frameLocator("#solo-all-host-frame");
  const seats = Array.from({ length: 3 }, (_, i) =>
    page.frameLocator("#solo-all-seat-frame-" + i));
  await expect(page.locator("#solo-status")).toContainText("is running with 3", { timeout: 35000 });
  await expect(page.locator("#solo-all-seat-switch option")).toHaveCount(3);
  const room = (await page.locator("#solo-all-room").innerText()).trim();
  const match = room.match(/^Temporary room ([A-HJ-NP-Z2-9]{6}) · /);
  expect(match).not.toBeNull();
  const code = match[1];
  expect(context.pages()).toHaveLength(1);

  for (const [index, round] of rounds.entries()) {
    const roundNumber = index + 1;
    await expect(host.locator("#heading")).toContainText("question", { timeout: 15000 });
    await expect(host.locator(".social-prompt")).toBeVisible();
    await expect(host.locator("#content")).toContainText("Round " + roundNumber + " of 5");
    await expect(host.locator("#content")).toContainText("0 submitted");
    await expect(host.locator("#content")).not.toContainText("Valid answers in this starter pack:");

    // Same valid category entry, in Spanish and English, must share the
    // canonical word and receive duplicate scores. A different valid
    // Spanish entry scores the 100-point unique-answer bonus.
    const answers = [round.spanish, round.english, round.unique];
    for (let seat = 0; seat < seats.length; seat++) {
      await page.locator("#solo-all-seat-switch").selectOption(String(seat));
      const input = seats[seat].locator("#family-response");
      await expect(input).toBeVisible();
      await input.fill(answers[seat]);
      const lock = seats[seat].getByRole("button", { name: "Lock answer", exact: true });
      await expect(lock).toBeEnabled();
      await lock.focus();
      await lock.press("Enter");
      if (seat < 2) {
        await expect(host.locator("#heading")).toContainText("question");
        await expect(host.locator("#content")).toContainText((seat + 1) + " submitted");
        await expect(host.locator("#content")).not.toContainText(answers[seat]);
        await expect(host.locator("#roster")).toContainText("You: " + index * 50 + " points");
      }
    }

    await expect(host.locator("#heading")).toContainText("reveal", { timeout: 15000 });
    await expect(host.locator("#content")).toContainText("3 submitted");
    await expect(host.locator("#content")).toContainText("You — " + round.spanish + " (50 pts)");
    await expect(host.locator("#content")).toContainText("Test Seat 2 — " + round.english + " (50 pts)");
    await expect(host.locator("#content")).toContainText("Test Seat 3 — " + round.unique + " (100 pts)");
    await expect(host.locator("#roster")).toContainText("You: " + roundNumber * 50 + " points");
    await expect(host.locator("#roster")).toContainText("Test Seat 2: " + roundNumber * 50 + " points");
    await expect(host.locator("#roster")).toContainText("Test Seat 3: " + roundNumber * 100 + " points");

    for (let seat = 0; seat < seats.length; seat++) {
      await page.locator("#solo-all-seat-switch").selectOption(String(seat));
      await expect(seats[seat].locator("#family-response")).toHaveCount(0);
    }
    await host.getByRole("button", { name: "Next", exact: true }).click();
  }

  await expect(host.locator("#heading")).toContainText("finished", { timeout: 15000 });
  await expect(host.locator("#content")).toContainText("Match complete!");
  await expect(host.locator("#roster")).toContainText("You: 250 points");
  await expect(host.locator("#roster")).toContainText("Test Seat 2: 250 points");
  await expect(host.locator("#roster")).toContainText("Test Seat 3: 500 points");

  await host.getByRole("button", { name: "Return to same party", exact: true }).click();
  await expect(host.locator("#heading")).toContainText(code + " · lobby", { timeout: 15000 });
  await expect(host.getByRole("button", { name: "Start match", exact: true })).toBeVisible();
  await expect(page.locator("#solo-all-room")).toContainText("Temporary room " + code);
  await expect(page.locator("#solo-all-seat-switch option")).toHaveCount(3);
  expect(context.pages()).toHaveLength(1);
  expect(errors).toEqual([]);

  await page.locator("#solo-stop").click();
  await expect(page.locator("#solo-all-stage")).toBeHidden();
  await expect(page.locator("#solo-all-seat-frames iframe")).toHaveCount(0);
});
