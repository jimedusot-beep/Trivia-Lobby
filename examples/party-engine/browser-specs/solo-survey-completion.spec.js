import { test, expect } from "@playwright/test";

// Real single-tab host + three authenticated guest controllers. Each round is
// completed through normal player submissions; no artificial round advancement,
// score mutation, timer acceleration, or early match stop.
const rounds = [
  { answer: "Passport", alias: "pasaporte" },
  { answer: "Popcorn", alias: "palomitas de maíz" },
  { answer: "Syrup", alias: "jarabe de maple" },
  { answer: "Towel", alias: "toalla" },
  { answer: "Milk", alias: "leche" },
];

test("completion: Survey Showdown scores five bilingual rounds then returns to the same party", async ({ page, context }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/solo-test.html");
  await page.locator("#solo-mode").selectOption("survey");
  await page.locator("#solo-seats").selectOption("3");
  await page.locator("#solo-start").click();

  const host = page.frameLocator("#solo-all-host-frame");
  const seats = Array.from({ length: 3 }, (_, index) =>
    page.frameLocator("#solo-all-seat-frame-" + index));
  await expect(page.locator("#solo-status")).toContainText("is running with 3", { timeout: 35000 });
  await expect(page.locator("#solo-all-seat-switch option")).toHaveCount(3);
  const room = (await page.locator("#solo-all-room").innerText()).trim();
  const match = room.match(/^Temporary room ([A-HJ-NP-Z2-9]{6}) · /);
  expect(match).not.toBeNull();
  const code = match[1];
  expect(context.pages()).toHaveLength(1);

  const names = ["You", "Test Seat 2", "Test Seat 3"];
  for (const [index, round] of rounds.entries()) {
    const roundNumber = index + 1;
    await expect(host.locator("#heading")).toContainText("question", { timeout: 15000 });
    await expect(host.locator(".social-prompt")).toBeVisible();
    await expect(host.locator("#content")).toContainText("Round " + roundNumber + " of 5");
    await expect(host.locator("#content")).toContainText("0 / 3 submitted");
    await expect(host.locator("#content")).not.toContainText(round.answer + ": 100 points");

    // Two equivalent language answers score equally; the third is not a
    // survey match. Hidden responses stay undisclosed until final submission.
    const answers = [round.answer, round.alias, "unlisted guess " + roundNumber];
    for (let seat = 0; seat < seats.length; seat++) {
      await page.locator("#solo-all-seat-switch").selectOption(String(seat));
      const input = seats[seat].locator("#social-response");
      await expect(input).toBeVisible();
      await input.fill(answers[seat]);
      const button = seats[seat].getByRole("button", { name: "Lock answer", exact: true });
      await expect(button).toBeEnabled();
      await button.focus();
      await button.press("Enter");
      if (seat < 2) {
        await expect(host.locator("#heading")).toContainText("question");
        await expect(host.locator("#content")).toContainText((seat + 1) + " / 3 submitted");
        await expect(host.locator("#content")).not.toContainText(round.answer + ": 100 points");
      }
    }

    await expect(host.locator("#heading")).toContainText("reveal", { timeout: 15000 });
    await expect(host.locator("#content")).toContainText("3 / 3 submitted");
    await expect(host.locator("#content")).toContainText(round.answer + ": 100 points · 2 matches");
    await expect(host.locator("#roster")).toContainText(names[0] + ": " + roundNumber * 100 + " points");
    await expect(host.locator("#roster")).toContainText(names[1] + ": " + roundNumber * 100 + " points");
    await expect(host.locator("#roster")).toContainText(names[2] + ": 0 points");

    for (let seat = 0; seat < seats.length; seat++) {
      await page.locator("#solo-all-seat-switch").selectOption(String(seat));
      await expect(seats[seat].locator(".phone-surface .phone-result")).toBeVisible();
      await expect(seats[seat].locator("#social-response")).toHaveCount(0);
    }
    await host.getByRole("button", { name: "Next", exact: true }).click();
  }

  await expect(host.locator("#heading")).toContainText("finished", { timeout: 15000 });
  await expect(host.locator("#content")).toContainText("Match complete!");
  await expect(host.locator("#roster")).toContainText("You: 500 points");
  await expect(host.locator("#roster")).toContainText("Test Seat 2: 500 points");
  await expect(host.locator("#roster")).toContainText("Test Seat 3: 0 points");

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
