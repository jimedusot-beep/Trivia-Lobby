import { quiz } from "./content.js";

// Explicit public fields only: never serialize the complete match or a session record.
export function projectParty(party, actor) {
  const reveal = party.phase === "reveal";
  const v = {
    code: party.code,
    phase: party.phase,
    mode: party.mode,
    revision: party.revision,
    matchId: party.matchId,
    deadline: party.deadline,
    serverNow: party.clock(),
    hostConnected: party.hostConnected,
    hostWaitAt: party.hostWaitAt,
    interrupted: party.interrupted,
    index: party.index,
    role: actor === "host" ? "host" : "player",
    players: [...party.players.values()]
      .map(({ id, name, connected, score, correct }) => ({
        id,
        name,
        connected,
        score,
        correct,
      }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)),
  };
  if (party.mode === "quiz" && ["question", "reveal"].includes(party.phase)) {
    const q = quiz[party.index];
    v.question = { prompt: q.prompt, choices: [...q.choices] };
    v.locked = party.answers.has(actor);
    v.received = party.answers.size;
    v.total = quiz.length;
    if (reveal) {
      v.question.correct = q.correct;
      v.question.explanation = q.explanation;
    }
  }
  if (party.mode === "duel" && party.phase === "writing") {
    v.assignments = party.pairs.flatMap((p, i) =>
      p.authors.includes(actor)
        ? [
            {
              prompt: p.prompt,
              promptIndex: i,
              locked: party.responses.has(`${i}:${actor}`),
            },
          ]
        : [],
    );
    v.received = party.responses.size;
    v.expected = party.roster.length * 2;
  }
  if (party.mode === "duel" && ["voting", "reveal"].includes(party.phase)) {
    v.prompt = party.pairs[party.index].prompt;
    v.skipped = party.skipped;
    v.total = party.pairs.length;
    v.canVote =
      party.phase === "voting" &&
      actor !== "host" &&
      !party.pairs[party.index].authors.includes(actor) &&
      !party.votes.has(actor);
    v.options = party.options.map((o) => ({
      id: o.id,
      text: o.text ?? "(No response)",
      ...(reveal
        ? {
            author: party.players.get(o.author).name,
            votes: [...party.votes.values()].filter((id) => id === o.id).length,
          }
        : {}),
    }));
    v.received = party.votes.size;
  }
  if (
    party.mode === "charades" &&
    ["countdown", "acting", "reveal"].includes(party.phase)
  ) {
    const performerId = party.roster[party.index];
    const turn = party.turn;
    v.charades = {
      performerId,
      performerName: party.players.get(performerId).name,
      category: party.category,
      turnNumber: party.index + 1,
      totalTurns: party.roster.length,
      canMark: party.phase === "acting" && actor === performerId,
    };
    if (party.phase === "acting" && actor === performerId) {
      const clue = turn.queue[turn.cursor];
      v.charades.clue = { id: clue.id, text: clue.text };
    }
    if (party.phase === "reveal")
      v.charades.history = turn.marks.map(({ text, result }) => ({
        text,
        result,
      }));
  }
  return v;
}
