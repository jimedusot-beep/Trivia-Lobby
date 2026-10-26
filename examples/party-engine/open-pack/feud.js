// SPDX-License-Identifier: AGPL-3.0-or-later
// Original implementation. Friendly Feud's game/host separation is a functional reference.
import {
  fail,
  readable,
  requireFields,
  integer,
  normalized,
  hostOnly,
  playerOnly,
  renewed,
  award,
} from "./shared.js";
import { defaultShow, validateShow } from "../public/show-format.js";
export { defaultShow, validateShow };
export function openFeud(p) {
  p.pack = {
    kind: "feud",
    teamScores: [0, 0],
    teamNames: ["Sunshine", "Starlight"],
    round: 0,
    stage: "buzz",
    revealed: [],
    strikes: 0,
    pot: 0,
    buzzer: null,
    team: null,
    finalAnswers: [[], []],
    finalCursor: 0,
    finalPlayer: 0,
    judged: false,
  };
  renewed(p, 45000);
}
const teamOf = (p, id) => p.roster.indexOf(id) % 2;
const board = (p) => p.show.rounds[p.pack.round];
function pay(p, team) {
  const s = p.pack;
  s.teamScores[team] += s.pot;
  for (const id of p.roster) if (teamOf(p, id) === team) award(p, id, s.pot);
  s.paidTo = team;
  s.stage = "board-reveal";
  p.enter("reveal");
}
function strike(p) {
  const s = p.pack;
  if (s.stage === "steal") {
    pay(p, s.team);
    return;
  }
  s.strikes++;
  if (s.strikes >= 3) {
    s.stage = "steal";
    renewed(p, 20000);
  } else {
    s.buzzer = null;
    renewed(p, 25000);
  }
}
function resolve(p, index) {
  const s = p.pack,
    q = board(p);
  if (s.stage === "steal") {
    if (!s.revealed.includes(index)) {
      s.pot += q.answers[index].points * q.multiplier;
      s.revealed.push(index);
      pay(p, 1 - s.team);
    } else strike(p);
    return;
  }
  if (s.revealed.includes(index)) fail("That answer is already revealed.");
  s.revealed.push(index);
  s.pot += q.answers[index].points * q.multiplier;
  if (s.team === null) s.team = teamOf(p, s.buzzer);
  s.stage = "play";
  s.buzzer = null;
  if (s.revealed.length === q.answers.length) pay(p, s.team);
  else renewed(p, 25000);
}
function finalists(p) {
  const s = p.pack;
  const team = s.teamScores[1] > s.teamScores[0] ? 1 : 0;
  const ids = p.roster.filter((id) => teamOf(p, id) === team);
  return [ids[0], ids[1] ?? ids[0]];
}
function nextFinal(p) {
  const s = p.pack;
  s.finalCursor++;
  if (s.finalCursor >= 5) {
    if (s.finalPlayer === 0) {
      s.finalPlayer = 1;
      s.finalCursor = 0;
      s.stage = "final-ready";
      p.enter("playing");
    } else {
      s.stage = "final-reveal";
      s.finalTotal = s.finalAnswers
        .flat()
        .reduce((sum, a) => sum + a.points, 0);
      p.enter("reveal");
    }
  } else p.revision++;
}
export function acceptFeud(p, actor, v) {
  const s = p.pack;
  requireFields(v, ["action"], ["index", "text", "name"]);
  if (v.action === "team-name") {
    hostOnly(actor);
    if (!integer(v.index, 0, 1) || typeof v.name !== "string")
      fail("Choose a team and name.");
    s.teamNames[v.index] = readable(v.name, 24);
    p.revision++;
    return;
  }
  if (v.action === "buzz") {
    playerOnly(p, actor);
    if (s.stage !== "buzz" || s.buzzer) fail("Buzzers are closed.");
    s.buzzer = actor;
    s.stage = "faceoff";
    renewed(p, 20000);
    return;
  }
  if (v.action === "judge") {
    hostOnly(actor);
    if (!["faceoff", "play", "steal"].includes(s.stage))
      fail("No answer to judge.");
    if (!integer(v.index, -1, board(p).answers.length - 1))
      fail("Choose a board answer or a strike.");
    if (v.index === -1) {
      if (s.stage === "faceoff") {
        s.team = 1 - teamOf(p, s.buzzer);
        s.stage = "play";
        s.buzzer = null;
        renewed(p, 25000);
      } else strike(p);
    } else resolve(p, v.index);
    return;
  }
  if (v.action === "pass") {
    hostOnly(actor);
    if (s.stage !== "play" || s.strikes || s.revealed.length !== 1 || s.passed)
      fail("Pass immediately after winning the buzzer.");
    s.team = 1 - s.team;
    s.passed = true;
    renewed(p, 25000);
    return;
  }
  if (v.action === "final-start") {
    hostOnly(actor);
    if (s.stage !== "final-ready") fail("Final is not ready.");
    s.stage = "final-answer";
    s.finalCursor = 0;
    renewed(p, s.finalPlayer === 0 ? 20000 : 25000);
    return;
  }
  if (v.action === "final-answer") {
    if (s.stage !== "final-answer" || actor !== finalists(p)[s.finalPlayer])
      fail("Only the current finalist can answer.");
    const text = readable(v.text, 60),
      q = p.show.final[s.finalCursor];
    const duplicate =
      s.finalPlayer === 1 &&
      normalized(s.finalAnswers[0][s.finalCursor]?.text ?? "") ===
        normalized(text);
    if (duplicate)
      fail("That answer was used by the first finalist. Try another or pass.");
    const answer = q.answers.find(
      (a) => normalized(a.text) === normalized(text),
    );
    s.finalAnswers[s.finalPlayer].push({ text, points: answer?.points ?? 0 });
    nextFinal(p);
    return;
  }
  if (v.action === "final-pass") {
    if (s.stage !== "final-answer" || actor !== finalists(p)[s.finalPlayer])
      fail("Only the current finalist may pass.");
    s.finalAnswers[s.finalPlayer].push({ text: "Pass", points: 0 });
    nextFinal(p);
    return;
  }
  fail("Unknown showdown action.");
}
export function tickFeud(p) {
  const s = p.pack;
  if (s.stage === "final-answer") {
    while (s.finalAnswers[s.finalPlayer].length < 5)
      s.finalAnswers[s.finalPlayer].push({ text: "Time", points: 0 });
    s.finalCursor = 4;
    nextFinal(p);
  } else if (s.stage === "buzz") {
    s.stage = "board-reveal";
    p.enter("reveal");
  } else if (s.stage === "faceoff") {
    s.team = 1 - teamOf(p, s.buzzer);
    s.stage = "play";
    s.buzzer = null;
    renewed(p, 25000);
  } else strike(p);
}
export function nextFeud(p) {
  const s = p.pack;
  if (s.stage === "final-reveal") {
    const team = s.teamScores[1] > s.teamScores[0] ? 1 : 0;
    s.teamScores[team] += s.finalTotal;
    for (const id of p.roster)
      if (teamOf(p, id) === team) award(p, id, s.finalTotal);
    p.enter("finished");
    return;
  }
  if (++s.round >= p.show.rounds.length) {
    s.stage = "final-ready";
    s.finalPlayer = 0;
    s.finalCursor = 0;
    p.enter("playing");
  } else {
    Object.assign(s, {
      stage: "buzz",
      revealed: [],
      strikes: 0,
      pot: 0,
      team: null,
      buzzer: null,
      passed: false,
      paidTo: null,
    });
    renewed(p, 45000);
  }
}
export function projectFeud(p, actor) {
  const s = p.pack,
    q = board(p),
    final = s.stage.startsWith("final"),
    host = actor === "host";
  const result = {
    kind: "feud",
    title: p.show.title,
    stage: s.stage,
    teams: s.teamNames.map((name, index) => ({
      name,
      score: s.teamScores[index],
      players: p.roster
        .filter((id) => teamOf(p, id) === index)
        .map((id) => p.players.get(id).name),
    })),
    team: s.team,
    strikes: s.strikes,
    pot: s.pot,
    buzzer: s.buzzer ? p.players.get(s.buzzer).name : null,
    round: s.round + 1,
    total: p.show.rounds.length,
    canBuzz: s.stage === "buzz" && !host,
  };
  if (!final) {
    result.question = q.question;
    result.multiplier = q.multiplier;
    result.board = q.answers.map((a, i) =>
      s.revealed.includes(i) || p.phase === "reveal"
        ? { ...a, index: i }
        : { index: i, hidden: true },
    );
    if (host) result.judge = q.answers.map((a, index) => ({ ...a, index }));
    result.passed = !!s.passed;
  } else {
    const ids = finalists(p);
    result.finalist = p.players.get(ids[s.finalPlayer]).name;
    result.canAnswer =
      actor === ids[s.finalPlayer] && s.stage === "final-answer";
    result.finalPlayer = s.finalPlayer + 1;
    result.finalCursor = s.finalCursor + 1;
    result.question = p.show.final[Math.min(s.finalCursor, 4)].question;
    if (s.stage === "final-reveal") {
      result.finalAnswers = s.finalAnswers;
      result.questions = p.show.final.map((q) => q.question);
      result.finalTotal = s.finalTotal;
      result.goal = 200;
    }
  }
  return result;
}
