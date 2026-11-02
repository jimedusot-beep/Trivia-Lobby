import { test, expect } from "@playwright/test";

// Real host and three independent browser contexts: every action flows through
// the existing room WebSocket, canonical player IDs and server-owned scores.
test("Spanish TV host and mixed-language phones keep one authoritative Majority round", async ({ browser }) => {
  const contexts = [];
  const openPage = async viewport => {
    const context = await browser.newContext({ viewport });
    contexts.push(context);
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("#status")).toHaveText("Connected.");
    return page;
  };
  try {
    const host = await openPage({ width: 1280, height: 800 });
    await host.locator("#create").click();
    const code = (await host.locator("#heading").innerText()).split(" · ")[0];
    const guests = [];
    for (let seat = 0; seat < 3; seat++) {
      const page = await openPage({ width: 390, height: 844 });
      // This is an independent guest setting; the host never sends its locale
      // through the network or changes another player's language.
      if (seat === 0) await page.locator("#party-language").selectOption("es");
      await page.locator("#code").fill(code);
      await page.locator("#name").fill("Seat " + (seat + 1));
      await page.locator("#join button").click();
      await expect(page.locator("body")).toHaveClass(/phone-controller-active/);
      guests.push(page);
    }
    // The TV control must live *inside* the fullscreen stage, not just in
    // the header that browser fullscreen removes.
    await expect(host.locator("#game #tv-language")).toBeVisible();
    await host.locator("#tv-language").selectOption("es");
    await expect(host.locator("#party-language")).toHaveValue("es");
    await expect(host.locator("#heading")).toContainText("sala");
    await expect(host.locator("#tv-fullscreen")).toContainText("Pantalla completa");
    await host.locator("#mode").selectOption("majority");
    await host.getByRole("button", { name: "Comenzar partida", exact: true }).click();

    await expect(host.locator("#heading")).toContainText("pregunta");
    await expect(host.locator(".social-prompt")).toContainText("¿");
    await expect(guests[0].locator(".social-prompt")).toContainText("¿");
    await expect(guests[1].locator(".social-prompt")).not.toContainText("¿");
    await expect(guests[0].locator("#phone-language")).toHaveValue("es");
    await expect(guests[1].locator("#phone-language")).toHaveValue("en");

    for (const guest of guests) {
      const buttons = guest.locator(".phone-surface .phone-choices button");
      await expect(buttons).toHaveCount(2);
      await buttons.first().click();
    }
    await expect(host.locator("#heading")).toContainText("resultados");
    await expect(host.locator("#roster")).toContainText("100 points");
    await expect(host.locator("#content")).toContainText("¡Mayoría!");
    const scoresBefore = await host.locator("#roster").innerText();

    // Switch the host only, in a live round; result data and guest languages
    // must remain unchanged. This is display-only, no room action.
    await host.locator("#tv-language").selectOption("en");
    await expect(host.locator("#party-language")).toHaveValue("en");
    await expect(host.locator("#heading")).toContainText("reveal");
    await expect(host.locator("#content")).toContainText("Majority!");
    expect(await host.locator("#roster").innerText()).toBe(scoresBefore);
    await expect(guests[0].locator("html")).toHaveAttribute("lang", "es");
    await expect(guests[1].locator("html")).toHaveAttribute("lang", "en");
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});
