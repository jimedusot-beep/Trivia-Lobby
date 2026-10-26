import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";

function room(mode) {
  let now = 1000, request = 0;
  const party = new Party("ABC234", { clock: () => now, countdownMs: 1 });
  const players = ["Pat", "Sam", "Lee"].map(name => party.join(name));
  const action = (actor, type, extras = {}) => party.handle(actor, {
    v: 1, type, requestId: `isolation-${++request}`,
    matchId: party.matchId, revision: party.revision, ...extras,
  });
  action("host", "start", { value: mode });
  now += 1; party.tick();
  return { party, players, action, advance(ms) { now += ms; party.tick(); } };
}
test("old Quiz answer frames cannot close an active Bracket Battle round", () => {
  const { party, players, action } = room("bracket");
  assert.equal(party.phase, "question");
  // Simulate partially submitted answers surviving from the previous Quiz match.
  party.answers = new Map([[players[0], 0], [players[1], 1]]);
  assert.throws(() => action(players[2], "answer", { value: 0 }), /Cannot submit another answer now/);
  assert.equal(party.phase, "question");
  assert.equal(party.bonus.entries.size, 0);
  assert.equal(party.answers.size, 2);
  for (const id of players) action(id, "respond", { value: 1 });
  assert.equal(party.phase, "reveal");
  assert.equal(party.bonus.entries.size, 3);
});
test("old Prompt Duel writing frames cannot contaminate a Caption Chaos round", () => {
  const { party, players, action } = room("caption");
  assert.equal(party.phase, "writing");
  party.responses = new Map([["prior:0", "old response"]]);
  assert.throws(() => action(players[0], "write", { value: "Old client write", promptIndex: 0 }), /Writing is closed/);
  assert.equal(party.phase, "writing");
  assert.equal(party.responses.size, 1);
  assert.equal(party.bonus.entries.size, 0);
  players.forEach((id, i) => action(id, "respond", { value: `Safe caption ${i}` }));
  assert.equal(party.phase, "voting");
});
test("old Prompt Duel voting frames cannot score or skip an Impostor vote", () => {
  const { party, players, action } = room("impostor");
  for (const id of players) action(id, "respond", { value: "A clue" });
  assert.equal(party.phase, "voting");
  party.votes = new Map([["old vote", "old option"]]);
  assert.throws(() => action(players[0], "vote", { value: "old option" }), /You cannot vote on this matchup now/);
  assert.equal(party.phase, "voting");
  assert.equal(party.social.votes.size, 0);
  for (let i = 0; i < players.length; i++)
    action(players[i], "respond", { value: players[(i + 1) % players.length] });
  assert.equal(party.phase, "reveal");
});
