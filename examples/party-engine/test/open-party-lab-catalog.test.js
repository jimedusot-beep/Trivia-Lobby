import test from "node:test";
import assert from "node:assert/strict";
import { openPartyLabBaseline, openPartyLabGames } from "../public/open-party-lab-games.js";
import { guestGames } from "../public/game-catalog.js";

const upstreamIds = [
  "magic-arena", "magic-duell", "tap-race", "pantomime", "air-hockey",
  "buzzwort", "imposter", "schaetzorama", "light-trails", "drift-racer",
  "word-tiles", "zeichnen-und-erraten", "arena-survivor", "minions-td",
  "chaos-kommando", "schattenjagd", "flatterfluff", "dungeon-party",
  "card-table", "blickwinkel", "dungeon-guild",
];

test("full Open Party Lab reference catalog has precisely the 21 public game repositories", () => {
  assert.deepEqual(openPartyLabGames.map((game) => game.id).sort(), upstreamIds.sort());
  assert.equal(new Set(openPartyLabGames.map((game) => game.id)).size, 21);
  assert.match(openPartyLabBaseline.revision, /^[a-f0-9]{40}$/);
  assert.equal(openPartyLabBaseline.source, "https://github.com/Hartwich/Open-Party-Lab");
});

test("catalog keeps the upstream published player capacities, never advertises all games for 20", () => {
  assert.deepEqual(
    Object.fromEntries(["drift-racer", "tap-race", "imposter", "card-table", "magic-duell", "dungeon-party"]
      .map((id) => [id, openPartyLabGames.find((game) => game.id === id)?.max])),
    { "drift-racer": 4, "tap-race": 8, "imposter": 20, "card-table": 16, "magic-duell": 2, "dungeon-party": 8 },
  );
  assert(openPartyLabGames.some((game) => game.max < 10));
  assert(openPartyLabGames.some((game) => game.max === 20));
  for (const game of openPartyLabGames) {
    assert(Number.isInteger(game.min) && Number.isInteger(game.max));
    assert(game.min >= 1 && game.min <= game.max && game.max <= 20);
    assert(game.description.trim());
    assert(game.controller.trim());
    assert.match(game.repository, new RegExp(`^https://github\\.com/Hartwich/${game.id}$`));
  }
});

test("upstream catalog IDs do not silently register unimplemented Trivia Lobby modes", () => {
  const local = new Set(guestGames.map((game) => game.id));
  for (const game of openPartyLabGames) assert(!local.has(game.id));
  assert.equal(guestGames.length, 28, "Original 24 plus Grand Prix, Tap Dash, Forbidden Word Frenzy and Light Trails Royale");
  assert(local.has("trails"), "The original Light Trails Royale mode is registered");
  assert(local.has("no-say"), "A native original forbidden-word game is registered");
  assert(local.has("tap"), "The new original 20-player Tap Dash must be registered");
  assert(local.has("race"), "The implemented Grand Prix remains separate from upstream research IDs");
});
