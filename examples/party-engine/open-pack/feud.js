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
    guided: true,
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
    pendingAnswer: null,
    lastDecision: null,
  };
  renewed(p, 45000);
}
const teamOf = (p, id) => p.roster.indexOf(id) % 2;
const board = (p) => p.show.rounds[p.pack.round];
function pay(p, team) {
  const s = p.pack;
  s.pendingAnswer = null;
  s.teamScores[team] += s.pot;
  for (const id of p.roster) if (teamOf(p, id) === team) award(p, id, s.pot);
  s.paidTo = team;
  s.stage = "board-reveal";
  p.enter("reveal");
}
function strike(p) {
  const s = p.pack;
  s.pendingAnswer = null;
  s.lastDecision =
    s.stage === "steal"
      ? "The steal missed. The controlling team keeps the pot."
      : "Missed answer. One strike added.";
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
  if (s.stage !== "steal" && s.revealed.includes(index))
    fail("That answer is already revealed.");
  s.pendingAnswer = null;
  s.lastDecision = `${q.answers[index].text} revealed: +${q.answers[index].points * q.multiplier} to the round pot.`;
  if (s.stage === "steal") {
    if (!s.revealed.includes(index)) {
      s.pot += q.answers[index].points * q.multiplier;
      s.revealed.push(index);
      pay(p, 1 - s.team);
    } else strike(p);
    return;
  }
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
      s.stage = s.guided ? "final-review" : "final-reveal";
      if (s.guided) p.enter("playing");
      else {
        s.finalTotal = s.finalAnswers
          .flat()
          .reduce((sum, a) => sum + a.points, 0);
        p.enter("reveal");
      }
    }
  } else p.revision++;
}
export function acceptFeud(p, actor, v) {
  const s = p.pack;
  requireFields(v, ["action"], ["index", "text", "name", "player", "question"]);
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
    s.pendingAnswer = null;
    s.lastDecision = null;
    s.stage = "faceoff";
    renewed(p, 20000);
    return;
  }
  if (v.action === "answer") {
    playerOnly(p, actor);
    const allowed =
      s.stage === "faceoff"
        ? actor === s.buzzer
        : s.stage === "play"
          ? teamOf(p, actor) === s.team
          : s.stage === "steal" && teamOf(p, actor) === 1 - s.team;
    if (!s.guided || !allowed || s.pendingAnswer)
      fail("Wait for your team's answer turn and the host's decision.");
    const text = readable(v.text, 60);
    const index = board(p).answers.findIndex(
      (a) => normalized(a.text) === normalized(text),
    );
    if (index >= 0 && !s.revealed.includes(index)) resolve(p, index);
    else {
      s.pendingAnswer = { actor, text };
      renewed(p, 20000);
    }
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
        s.pendingAnswer = null;
        s.lastDecision =
          "The buzzer answer missed. The other team takes control.";
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
    if (
      s.stage !== "play" ||
      s.strikes ||
      s.revealed.length !== 1 ||
      s.passed ||
      s.pendingAnswer
    )
      fail("Pass immediately after winning the buzzer.");
    s.team = 1 - s.team;
    s.passed = true;
    s.lastDecision = `Control passed to ${s.teamNames[s.team]}.`;
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
    s.finalAnswers[s.finalPlayer].push({
      text,
      points: answer?.points ?? 0,
      ...(s.guided ? { index: answer ? q.answers.indexOf(answer) : -1 } : {}),
    });
    nextFinal(p);
    return;
  }
  if (v.action === "final-judge") {
    hostOnly(actor);
    if (!s.guided || s.stage !== "final-review")
      fail("The lightning final is not ready for review.");
    if (
      !integer(v.player, 0, 1) ||
      !integer(v.question, 0, 4) ||
      !integer(v.index, -1, p.show.final[v.question].answers.length - 1)
    )
      fail("Choose a finalist, question and board answer.");
    const other = s.finalAnswers[1 - v.player][v.question];
    if (v.index >= 0 && other.index === v.index)
      fail("That board answer is already credited to the other run.");
    const response = s.finalAnswers[v.player][v.question];
    if (response.skipped && v.index >= 0)
      fail("A passed or timed-out question cannot earn points.");
    response.index = v.index;
    response.points =
      v.index < 0 ? 0 : p.show.final[v.question].answers[v.index].points;
    p.revision++;
    return;
  }
  if (v.action === "final-publish") {
    hostOnly(actor);
    if (!s.guided || s.stage !== "final-review")
      fail("The lightning final is not ready for review.");
    s.finalTotal = s.finalAnswers.flat().reduce((sum, a) => sum + a.points, 0);
    s.stage = "final-reveal";
    p.enter("reveal");
    return;
  }
  if (v.action === "final-pass") {
    if (s.stage !== "final-answer" || actor !== finalists(p)[s.finalPlayer])
      fail("Only the current finalist may pass.");
    s.finalAnswers[s.finalPlayer].push({
      text: "Pass",
      points: 0,
      ...(s.guided ? { skipped: true, index: -1 } : {}),
    });
    nextFinal(p);
    return;
  }
  fail("Unknown showdown action.");
}
export function tickFeud(p) {
  const s = p.pack;
  if (s.stage === "final-answer") {
    while (s.finalAnswers[s.finalPlayer].length < 5)
      s.finalAnswers[s.finalPlayer].push({
        text: "Time",
        points: 0,
        ...(s.guided ? { skipped: true, index: -1 } : {}),
      });
    s.finalCursor = 4;
    nextFinal(p);
  } else if (s.stage === "buzz") {
    s.stage = "board-reveal";
    p.enter("reveal");
  } else if (s.stage === "faceoff") {
    s.pendingAnswer = null;
    s.lastDecision =
      "The buzzer answer timed out. The other team takes control.";
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
      pendingAnswer: null,
      lastDecision: null,
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
    guided: !!s.guided,
    myTeam: host ? null : teamOf(p, actor),
    lastDecision: s.lastDecision ?? null,
    paidTo: s.paidTo ?? null,
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
    result.canSubmit =
      !!s.guided &&
      !host &&
      !s.pendingAnswer &&
      p.phase === "playing" &&
      (s.stage === "faceoff"
        ? actor === s.buzzer
        : s.stage === "play"
          ? teamOf(p, actor) === s.team
          : s.stage === "steal" && teamOf(p, actor) === 1 - s.team);
    result.waitingForHost = !!s.pendingAnswer;
    if (s.pendingAnswer && (host || actor === s.pendingAnswer.actor))
      result.submittedAnswer = {
        text: s.pendingAnswer.text,
        name: p.players.get(s.pendingAnswer.actor).name,
      };
  } else {
    const ids = finalists(p);
    result.finalist = p.players.get(ids[s.finalPlayer]).name;
    result.canAnswer =
      actor === ids[s.finalPlayer] && s.stage === "final-answer";
    result.finalPlayer = s.finalPlayer + 1;
    result.soloFinalist = ids[0] === ids[1];
    result.finalTeam = s.teamScores[1] > s.teamScores[0] ? 1 : 0;
    result.finalCursor = s.finalCursor + 1;
    result.question = p.show.final[Math.min(s.finalCursor, 4)].question;
    if (s.stage === "final-review" && host)
      result.finalReview = p.show.final.map((q, index) => ({
        question: q.question,
        choices: q.answers.map((answer) => ({ ...answer })),
        responses: s.finalAnswers.map((run) => ({ ...run[index] })),
      }));
    if (s.stage === "final-reveal") {
      result.finalAnswers = s.finalAnswers;
      result.questions = p.show.final.map((q) => q.question);
      result.finalTotal = s.finalTotal;
      result.goal = 200;
    }
  }
  return result;
}
