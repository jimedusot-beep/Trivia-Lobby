import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { guestGames } from "../public/game-catalog.js";

// Fast real-engine coverage for Solo Test's complete catalog. This is not a
// simulated player-action or full-match completion test: every start uses the
// normal host action, minimum real player count and authoritative projections.
test("each of the 31 Solo Test catalog modes starts with its normal seat minimum", async (t) => {
  assert.equal(guestGames.length, 31);
  assert.equal(new Set(guestGames.map((game) => game.id)).size, 31);

  for (const game of guestGames) {
    await t.test(game.id, () => {
      assert.ok(Number.isSafeInteger(game.min) && game.min >= 1 && game.min <= 5,
        "the one-tab lab must be able to supply the regular minimum for " + game.id);
      assert.ok(Number.isSafeInteger(game.max) && game.max >= game.min);

      let now = 1000;
      const party = new Party("ABC234", { clock: () => now, countdownMs: 1 });
      const actors = Array.from({ length: game.min }, (_, i) => party.join("Test seat " + (i + 1)));
      assert.equal(party.players.size, game.min);

      party.handle("host", {
        v: 1, type: "start", requestId: "catalog-start-" + game.id,
        matchId: party.matchId, revision: party.revision, value: game.id,
      });
      assert.notEqual(party.phase, "lobby", game.id + " must be accepted by the real engine");
      if (party.phase === "countdown") {
        now += 1;
        party.tick();
      }
      assert.notEqual(party.phase, "lobby", game.id + " must stay in the match");
      assert.notEqual(party.phase, "countdown", game.id + " must open after countdown");

      const host = party.view("host");
      const guest = party.view(actors[0]);
      assert.equal(host.mode, game.id);
      assert.equal(guest.mode, game.id);
      assert.equal(host.players.length, game.min);
      assert.equal(guest.players.length, game.min);
      assert.equal(party.roster.length, game.min);
      assert.ok(party.matchId, "an actual server match must be allocated");
    });
  }
});
