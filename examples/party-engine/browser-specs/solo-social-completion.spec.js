import { test, expect } from "@playwright/test";

// These are full, normal-server matches through the actual embedded host and
// three independent guest controllers. No mock state, virtual score awards,
// forced timeouts, shortened rounds or host early-stop action is used.
const scenarios = [
  {
    id: "majority",
    name: "Majority Rules",
    roundScores: [100, 100, 0],
    async submit(frame, seat) {
      // Two seats choose the first option; the third chooses the second.
      const buttons = frame.locator("#content button");
      await expect(buttons).toHaveCount(2);
      const choice = buttons.nth(seat === 2 ? 1 : 0);
      await expect(choice).toBeEnabled();
      await choice.focus();
      await choice.press("Enter");
    },
    async verifyReveal(host) {
      await expect(host.locator("#content")).toContainText("Majority!");
      await expect(host.locator("#content")).toContainText("2 votes");
    }
  },
  {
    id: "likely",
    name: "Who's Most Likely?",
    roundScores: [100, 0, 100],
    async submit(frame, seat) {
      // A guest cannot nominate themselves. Two seats nominate Seat 2;
      // Seat 2 nominates Seat 1, producing a real server-scored majority.
      const nominee = seat === 1 ? "You" : "Test Seat 2";
      const choice = frame.locator("#content").getByRole("button", { name: nominee, exact: true });
      await expect(choice).toBeEnabled();
      await choice.focus();
      await choice.press("Enter");
    },
    async verifyReveal(host) {
      await expect(host.locator("#content")).toContainText("Test Seat 2 · 2 votes");
      await expect(host.locator("#content")).toContainText("Top choice!");
    }
  },
  {
    id: "closest",
    name: "Closest Wins",
    roundScores: [0, 0, 100],
    async submit(frame, seat) {
      // The existing five family questions have positive targets > 2.
      // 0, 1, 2 are intentionally valid but different estimates. The
      // actual answer stays server-private until reveal; Seat 3 is closest.
      const input = frame.locator("#social-response");
      await expect(input).toBeVisible();
      await input.fill(String(seat));
      const lock = frame.locator("#content").getByRole("button", { name: "Lock answer", exact: true });
      await expect(lock).toBeEnabled();
      await lock.focus();
      await lock.press("Enter");
    },
    async verifyReveal(host) {
      await expect(host.locator("#content")).toContainText("Answer:");
      await expect(host.locator("#content")).toContainText("Closest: Test Seat 3");
    }
  }
];

for (const scenario of scenarios) {
  test("completion: " + scenario.name + " completes five scored rounds and returns to same room", async ({ page, context }) => {
    test.setTimeout(180000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/solo-test.html");
    await page.locator("#solo-mode").selectOption(scenario.id);
    await page.locator("#solo-seats").selectOption("3");
    await page.locator("#solo-start").click();

    const host = page.frameLocator("#solo-all-host-frame");
    const seats = Array.from({ length: 3 }, (_, i) => page.frameLocator("#solo-all-seat-frame-" + i));
    await expect(page.locator("#solo-status")).toContainText("is running with 3", { timeout: 35000 });
    await expect(page.locator("#solo-all-seat-switch option")).toHaveCount(3);
    const room = (await page.locator("#solo-all-room").innerText()).trim();
    expect(room).toMatch(/^Temporary room [A-HJ-NP-Z2-9]{6} · /);
    const code = room.match(/Temporary room ([A-HJ-NP-Z2-9]{6})/)[1];
    expect(context.pages()).toHaveLength(1);

    const names = ["You", "Test Seat 2", "Test Seat 3"];
    for (let round = 1; round <= 5; round++) {
      await expect(host.locator("#heading")).toContainText("question", { timeout: 15000 });
      await expect(host.locator(".social-prompt")).toBeVisible();
      await expect(host.locator("#content")).toContainText("Round " + round + " of 5");
      await expect(host.locator("#content")).toContainText("0 / 3 submitted");
      // Private choices and the answer key are not disclosed to the TV
      // before all guest controllers make their real submissions.
      if (scenario.id === "closest") {
        await expect(host.locator("#content")).not.toContainText("Answer:");
      }

      for (let seat = 0; seat < 3; seat++) {
        await page.locator("#solo-all-seat-switch").selectOption(String(seat));
        await scenario.submit(seats[seat], seat);
        if (seat < 2) {
          await expect(host.locator("#heading")).toContainText("question");
          await expect(host.locator("#content")).toContainText((seat + 1) + " / 3 submitted");
        }
      }

      await expect(host.locator("#heading")).toContainText("reveal", { timeout: 15000 });
      await expect(host.locator("#content")).toContainText("3 / 3 submitted");
      await scenario.verifyReveal(host);
      for (let seat = 0; seat < 3; seat++) {
        await expect(host.locator("#roster")).toContainText(
          names[seat] + ": " + scenario.roundScores[seat] * round + " points"
        );
        await expect(seats[seat].locator("#content button")).toHaveCount(0);
      }
      await host.getByRole("button", { name: "Next", exact: true }).click();
    }

    await expect(host.locator("#heading")).toContainText("finished", { timeout: 15000 });
    await expect(host.locator("#content")).toContainText("Match complete!");
    for (let seat = 0; seat < 3; seat++) {
      await expect(host.locator("#roster")).toContainText(
        names[seat] + ": " + scenario.roundScores[seat] * 5 + " points"
      );
    }
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
}
