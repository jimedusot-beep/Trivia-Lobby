import { test, expect } from "@playwright/test";

// Real single-tab host and three ordinary guest controllers. No mocked
// sockets/state, accelerated timers, score changes, or early host stop.
const rounds = [
  { votes: [1, 1, 0], guesses: [67, 57, 0], actual: 67 },
  { votes: [1, 0, 0], guesses: [33, 43, 100], actual: 33 },
  { votes: [1, 1, 1], guesses: [100, 90, 0], actual: 100 },
  { votes: [0, 0, 0], guesses: [0, 10, 100], actual: 0 },
  { votes: [1, 1, 0], guesses: [67, 57, 0], actual: 67 },
];
// Fixed expected outcomes, independent of the engine's answer/scoring code.
const names = ["You", "Test Seat 2", "Test Seat 3"];
const pointsPerRound = [100, 80, 0];

test("completion: Guess the Percentage finishes five private scored rounds, reconnects a locked guest, and returns to the same party", async ({ page, context }) => {
  test.setTimeout(180000);
  const errors = [], leaks = [], responses = new Map();
  let privateProjections = 0, hostPlayerIds = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("websocket", socket => {
    socket.on("framesent", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "respond") responses.set(message.requestId, message.value);
    });
    socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type !== "state") return;
      const state = message.state;
      if (state.role === "host") hostPlayerIds = state.players.map(player => player.id).sort();
      if (state.bonus?.kind !== "percentage" || !["writing", "voting"].includes(state.phase)) return;
      privateProjections++;
      for (const key of ["actual", "yes", "totalVotes"]) {
        if (Object.hasOwn(state.bonus, key)) leaks.push({ phase: state.phase, role: state.role, key });
      }
    });
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/solo-test.html");
  await page.locator("#solo-mode").selectOption("percentage");
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

  async function assertScores(completedRounds) {
    await expect(host.locator("#roster li")).toHaveCount(3);
    for (let seat = 0; seat < seats.length; seat++) {
      await expect(host.locator("#roster")).toContainText(
        names[seat] + ": " + completedRounds * pointsPerRound[seat] + " points"
      );
    }
  }
  for (const [index, round] of rounds.entries()) {
    const roundNumber = index + 1;
    await expect(host.locator("#heading")).toContainText("writing", { timeout: 15000 });
    await expect(host.locator("#content")).toContainText("Round " + roundNumber + " of 5");
    await expect(host.locator("#content")).toContainText("0 submitted");
    await assertScores(index);
    for (let seat = 0; seat < seats.length; seat++) {
      await page.locator("#solo-all-seat-switch").selectOption(String(seat));
      const vote = seats[seat].locator(".phone-surface").getByRole("button", {
        name: round.votes[seat] ? "Yes" : "No", exact: true,
      });
      await expect(vote).toBeEnabled();
      // Ordinary keyboard activation avoids nested-frame pointer placement;
      // the separate UI suites retain pointer and touch coverage.
      await vote.focus();
      await vote.press("Enter");
      if (seat < 2) {
        await expect(host.locator("#heading")).toContainText("writing");
        await expect(host.locator("#content")).toContainText((seat + 1) + " submitted");
        await expect(host.locator("#content")).not.toContainText("% said YES");
      }
    }
    await expect(host.locator("#heading")).toContainText("voting", { timeout: 15000 });
    await expect(host.locator("#content")).toContainText("0 submitted");
    await expect(host.locator("#content")).not.toContainText("% said YES");
    for (let seat = 0; seat < seats.length; seat++) {
      await page.locator("#solo-all-seat-switch").selectOption(String(seat));
      const input = seats[seat].locator("#family-response");
      await expect(input).toBeVisible();
      await input.fill(String(round.guesses[seat]));
      const lock = seats[seat].getByRole("button", { name: "Lock answer", exact: true });
      await expect(lock).toBeEnabled();
      await lock.focus();
      await lock.press("Enter");
      if (seat < 2) {
        await expect(host.locator("#heading")).toContainText("voting");
        await expect(host.locator("#content")).toContainText((seat + 1) + " submitted");
        await expect(host.locator("#content")).not.toContainText("% said YES");
        await assertScores(index);
      }
      if (roundNumber === 3 && seat === 0) {
        await expect(seats[0].locator("#status")).toHaveText("Submission accepted.");
        const originalPlayers = [...hostPlayerIds];
        expect(new Set(originalPlayers).size).toBe(3);
        // A Solo Test reload loses its ephemeral identity. The existing online
        // lifecycle closes/reopens the real socket and resumes the same guest.
        await seats[0].locator("html").evaluate(() => window.dispatchEvent(new Event("online")));
        await expect(seats[0].locator("#status")).toHaveText("Reconnected.", { timeout: 15000 });
        await expect(host.locator("#roster")).not.toContainText("disconnected");
        expect(hostPlayerIds).toEqual(originalPlayers);
        await expect(host.locator("#heading")).toContainText("voting");
        await expect(host.locator("#content")).toContainText("1 submitted");
        await expect(seats[0].locator("#family-response")).toHaveCount(0);
        await assertScores(index);
      }
    }
    await expect(host.locator("#heading")).toContainText("reveal", { timeout: 15000 });
    const yes = round.votes.filter(Boolean).length;
    await expect(host.locator("#content")).toContainText(
      round.actual + "% said YES (" + yes + " of 3 votes)"
    );
    await assertScores(roundNumber);
    for (let seat = 0; seat < seats.length; seat++) {
      await page.locator("#solo-all-seat-switch").selectOption(String(seat));
      await expect(seats[seat].locator("#family-response")).toHaveCount(0);
      await expect(seats[seat].locator(".phone-surface .phone-choices button")).toHaveCount(0);
    }
    await host.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(host.locator("#heading")).toContainText("finished", { timeout: 15000 });
  await expect(host.locator("#content")).toContainText("Match complete!");
  await expect(host.locator("#content")).toContainText("Leaders: You");
  await assertScores(5);
  await host.getByRole("button", { name: "Return to same party", exact: true }).click();
  await expect(host.locator("#heading")).toContainText(code + " · lobby", { timeout: 15000 });
  await expect(host.getByRole("button", { name: "Start match", exact: true })).toBeVisible();
  await assertScores(5);
  for (const name of names) await expect(host.locator("#roster")).toContainText(name + ":");
  await expect(page.locator("#solo-all-room")).toContainText("Temporary room " + code);
  await expect(page.locator("#solo-all-seat-switch option")).toHaveCount(3);
  expect(context.pages()).toHaveLength(1);
  expect(privateProjections).toBeGreaterThan(0);
  expect(leaks).toEqual([]);
  expect([...responses.values()]).toEqual(rounds.flatMap(round => [...round.votes, ...round.guesses]));
  expect(errors).toEqual([]);
  await page.locator("#solo-stop").click();
  await expect(page.locator("#solo-all-stage")).toBeHidden();
  await expect(page.locator("#solo-all-seat-frames iframe")).toHaveCount(0);
});
