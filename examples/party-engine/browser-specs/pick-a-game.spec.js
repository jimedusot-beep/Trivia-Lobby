import { test, expect } from "@playwright/test";
import { guestGames } from "../public/game-catalog.js";

for (const game of guestGames) {
  test(`Pick a Game: ${game.name} shows rules, QR join and recovers guest nickname`, async ({ browser }) => {
    const hostContext=await browser.newContext({viewport:{width:1280,height:850}});
    const guestContext=await browser.newContext({viewport:{width:390,height:844}});
    try {
      const host=await hostContext.newPage();
      await host.goto("http://127.0.0.1:4317/");
      await expect(host.getByRole("heading",{name:"Pick a Game"})).toBeVisible();
      const card=host.locator(`[data-game="${game.id}"]`);
      await expect(card).toContainText(game.players);
      await expect(card).toContainText(game.rules);
      const hostButton=card.getByRole("button",{name:new RegExp("Host "+game.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))});
      await hostButton.click();
      await expect(host.locator("#heading")).toContainText("lobby");
      await expect(host.getByLabel("Game mode")).toHaveValue(game.id);
      if (game.id === "charades")
        await host.getByLabel("Charades pack").selectOption("animals");
      const code=(await host.locator("#heading").innerText()).split(" · ")[0];
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      const svg=host.locator("#party-invitation svg[role='img']");
      await expect(svg).toHaveCount(1);
      await expect(svg).toHaveAttribute("aria-label",new RegExp(code));
      const url=await host.locator("#invite-link").inputValue();
      expect(new URL(url).searchParams.get("code")).toBe(code);
      expect(new URL(url).origin).toBe("http://127.0.0.1:4317");
      const guest=await guestContext.newPage();
      await guest.goto(url);
      await expect(guest.getByLabel("Party code")).toHaveValue(code);
      await guest.getByLabel("Nickname").fill("Family Guest");
      await guest.getByRole("button",{name:"Join party"}).click();
      await expect(guest.locator("#heading")).toContainText("lobby");
      await expect(host.locator("#roster")).toContainText("Family Guest");
      const before=await guest.locator("#roster").innerText();
      await guest.reload();
      await expect(guest.locator("#heading")).toContainText("lobby");
      await expect(guest.locator("#roster")).toContainText("Family Guest");
      expect((await guest.locator("#roster").innerText())).toBe(before);
      await expect(guest.getByLabel("Email")).toHaveCount(0);

      // Recover the host's setup as well as its identity. A reload must not
      // silently replace a tile-selected game with the default Trivia Quiz.
      await host.reload();
      await expect(host.locator("#heading")).toHaveText(`${code} · lobby`);
      await expect(host.getByLabel("Game mode")).toHaveValue(game.id);
      await expect(host.locator(".pick-game-selection")).toContainText(game.name);
      await expect(host.locator("#invite-link")).toHaveValue(url);
      await expect(host.locator("#roster")).toContainText("Family Guest");
      if (game.id === "charades")
        await expect(host.getByLabel("Charades pack")).toHaveValue("animals");

      if (game.id === "quiz") {
        await host.getByLabel("Game mode").selectOption("bingo");
        await expect(host.locator(".pick-game-selection")).toContainText("Family Bingo");
        await host.reload();
        await expect(host.locator("#heading")).toHaveText(`${code} · lobby`);
        await expect(host.getByLabel("Game mode")).toHaveValue("bingo");
        await host.getByRole("button", { name: "Leave this device" }).click();
        await host.getByRole("button", { name: "Host Trivia Quiz, 3–20 players", exact: true }).click();
        await expect(host.locator("#heading")).toContainText("lobby");
        await expect(host.getByLabel("Game mode")).toHaveValue("quiz");
        expect((await host.locator("#heading").innerText()).split(" · ")[0]).not.toBe(code);
      }
    } finally {
      await guestContext.close();
      await hostContext.close();
    }
  });
}
