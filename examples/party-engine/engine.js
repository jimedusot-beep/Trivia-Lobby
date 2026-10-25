import { randomInt, randomUUID } from "node:crypto";
import { quiz, prompts } from "./content.js";
import { validateAction } from "./protocol.js";
import { makeTurn, markClue, finishTurn } from "./charades.js";
import { projectParty } from "./projections.js";
const fail = (message) => {
  throw new Error(message);
};
export class Party {
  constructor(
    code,
    {
      clock = () => performance.timeOrigin + performance.now(),
      quizMs = 30000,
      writeMs = 90000,
      voteMs = 20000,
      countdownMs = 3000,
      charadesMs = 60000,
    } = {},
  ) {
    Object.assign(this, {
      code,
      clock,
      quizMs,
      writeMs,
      voteMs,
      countdownMs,
      charadesMs,
    });
    this.players = new Map();
    this.hostConnected = true;
    this.phase = "lobby";
    this.mode = "quiz";
    this.revision = 0;
    this.matchId = null;
    this.index = 0;
    this.deadline = null;
    this.touched = clock();
    this.requests = new Map();
    this.interrupted = false;
    this.hostWaitAt = null;
  }
  join(name) {
    if (this.phase !== "lobby")
      fail("Match started. New players wait for the next lobby.");
    if (this.players.size >= 8) fail("Room full.");
    if (typeof name !== "string" || !name.trim() || name.trim().length > 24)
      fail("Nickname must contain 1–24 characters.");
    if (
      [...this.players.values()].some(
        (p) => p.name.toLowerCase() === name.trim().toLowerCase(),
      )
    )
      fail("That nickname is in use.");
    const id = randomUUID();
    this.players.set(id, {
      id,
      name: name.trim(),
      connected: true,
      score: 0,
      correct: 0,
    });
    this.touched = this.clock();
    return id;
  }
  connected(id, connected) {
    if (id === "host") this.hostConnected = connected;
    else {
      const p = this.players.get(id);
      if (p) p.connected = connected;
    }
    this.updateHostWait();
  }
  updateHostWait() {
    if (this.hostConnected) this.hostWaitAt = null;
    else if (
      !this.deadline &&
      this.phase !== "finished" &&
      this.hostWaitAt === null
    )
      this.hostWaitAt = this.clock();
  }
  enter(phase, ms = null) {
    this.phase = phase;
    this.revision++;
    this.deadline = ms === null ? null : this.clock() + ms;
    this.hostWaitAt = null;
    this.touched = this.clock();
    this.updateHostWait();
  }
  tick() {
    if (this.deadline !== null && this.clock() >= this.deadline) {
      if (this.phase === "countdown") this.open();
      else if (this.phase === "writing") {
        this.index = 0;
        this.openVote();
      } else if (["question", "voting", "acting"].includes(this.phase))
        this.closeRound();
    }
    if (this.hostWaitAt !== null && this.clock() - this.hostWaitAt >= 60000) {
      this.interrupted = true;
      this.enter("finished");
    }
  }
  open() {
    if (this.mode === "charades") {
      this.turn = makeTurn(this.roster[this.index], this.category);
      this.enter("acting", this.charadesMs);
      return;
    }
    if (this.mode === "quiz") {
      this.answers = new Map();
      this.enter("question", this.quizMs);
    } else {
      this.responses = new Map();
      this.enter("writing", this.writeMs);
    }
  }
  openVote() {
    const pair = this.pairs[this.index];
    this.votes = new Map();
    this.options = pair.authors.map((id) => ({
      id: randomUUID(),
      author: id,
      text: this.responses.get(`${this.index}:${id}`),
    }));
    if (randomInt(2)) this.options.reverse();
    if (this.options.some((o) => !o.text)) {
      this.skipped = true;
      this.enter("reveal");
    } else {
      this.skipped = false;
      this.enter("voting", this.voteMs);
    }
  }
  closeRound() {
    if (this.mode === "quiz") {
      for (const [id, answer] of this.answers)
        if (answer === quiz[this.index].correct) {
          const p = this.players.get(id);
          p.score += 100;
          p.correct++;
        }
    } else if (this.mode === "duel") {
      for (const optionId of this.votes.values()) {
        const option = this.options.find((o) => o.id === optionId);
        this.players.get(option.author).score += 100;
      }
    }
    if (this.mode === "charades") finishTurn(this.turn);
    this.enter("reveal");
  }
  // Credentials bind actor outside this reducer. Request IDs are bounded per actor.
  handle(actor, msg) {
    validateAction(msg);
    const key = `${actor}:${msg.requestId}`,
      fingerprint = JSON.stringify(msg);
    const previous = this.requests.get(key);
    if (previous) {
      if (previous.fingerprint !== fingerprint) fail("Request ID conflict.");
      return previous.result;
    }
    this.tick();
    if (msg.matchId !== this.matchId || msg.revision !== this.revision)
      fail("Your screen is out of date. Try again after synchronization.");
    if (actor !== "host" && !this.players.has(actor)) fail("Unknown player.");
    if (msg.type === "start") {
      if (actor !== "host" || this.phase !== "lobby")
        fail("Only the host can start from the lobby.");
      if (!["quiz", "duel", "charades"].includes(msg.value))
        fail("Unknown game mode.");
      // Validate before pruning: a rejected start must not revoke a disconnected
      // participant's reconnect access while the party is still in the lobby.
      const activePlayers = [...this.players.values()].filter(
        (p) => p.connected,
      );
      if (activePlayers.length < 3 || activePlayers.length > 8)
        fail("Start with 3–8 connected players.");
      for (const [id, p] of this.players)
        if (!p.connected) this.players.delete(id);
      this.mode = msg.value;
      this.category = msg.category ?? "actions";
      this.matchId = randomUUID();
      this.index = 0;
      this.interrupted = false;
      this.roster = [...this.players.keys()];
      this.players.forEach((p) => {
        p.score = 0;
        p.correct = 0;
      });
      this.pairs = this.roster.map((id, i) => ({
        prompt: prompts[i],
        authors: [id, this.roster[(i + 1) % this.roster.length]],
      }));
      this.enter("countdown", this.countdownMs);
    } else if (msg.type === "answer") {
      if (
        actor === "host" ||
        this.phase !== "question" ||
        this.answers.has(actor)
      )
        fail("Cannot submit another answer now.");
      if (!Number.isInteger(msg.value) || msg.value < 0 || msg.value > 3)
        fail("Invalid choice.");
      this.answers.set(actor, msg.value);
      if (this.answers.size === this.roster.length) this.closeRound();
    } else if (msg.type === "write") {
      if (actor === "host" || this.phase !== "writing")
        fail("Writing is closed.");
      const pair = this.pairs[msg.promptIndex],
        slot = `${msg.promptIndex}:${actor}`;
      if (!pair || !pair.authors.includes(actor) || this.responses.has(slot))
        fail("Not your prompt or response already locked.");
      if (
        typeof msg.value !== "string" ||
        !msg.value.trim() ||
        msg.value.trim().length > 240
      )
        fail("Write 1–240 characters.");
      this.responses.set(slot, msg.value.trim());
      if (this.responses.size === this.roster.length * 2) {
        this.index = 0;
        this.openVote();
      }
    } else if (msg.type === "vote") {
      if (
        actor === "host" ||
        this.phase !== "voting" ||
        this.pairs[this.index].authors.includes(actor) ||
        this.votes.has(actor)
      )
        fail("You cannot vote on this matchup now.");
      if (!this.options.some((o) => o.id === msg.value)) fail("Invalid vote.");
      this.votes.set(actor, msg.value);
      if (this.votes.size === this.roster.length - 2) this.closeRound();
    } else if (msg.type === "mark") {
      if (
        this.mode !== "charades" ||
        this.phase !== "acting" ||
        actor !== this.turn.performerId
      )
        fail("Only the current performer may mark a clue.");
      this.players.get(actor).score += markClue(
        this.turn,
        msg.clueId,
        msg.value,
      );
      // Invalidate duplicate physical/touch actions without extending the turn deadline.
      this.revision++;
      if (this.turn.cursor === this.turn.queue.length) this.closeRound();
    } else if (msg.type === "next") {
      if (actor !== "host" || this.phase !== "reveal")
        fail("Only the host can advance after reveal.");
      const total =
        this.mode === "quiz"
          ? quiz.length
          : this.mode === "charades"
            ? this.roster.length
            : this.pairs.length;
      if (++this.index >= total) this.enter("finished");
      else if (this.mode === "charades")
        this.enter("countdown", this.countdownMs);
      else if (this.mode === "quiz") this.open();
      else this.openVote();
    } else if (msg.type === "lobby") {
      if (actor !== "host" || this.phase !== "finished")
        fail("Finish before returning to the lobby.");
      this.matchId = null;
      this.enter("lobby");
    } else fail("Unknown action.");
    this.touched = this.clock();
    const result = { requestId: msg.requestId, accepted: true };
    this.requests.set(key, { fingerprint, result });
    const actorEntries = [...this.requests.keys()].filter((k) =>
      k.startsWith(actor + ":"),
    );
    if (actorEntries.length > 256) this.requests.delete(actorEntries[0]);
    if (this.requests.size > 4096)
      this.requests.delete(this.requests.keys().next().value);
    return result;
  }
  view(actor) {
    return projectParty(this, actor);
  }
}
export function roomCode(occupied) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let tries = 0; tries < 50; tries++) {
    const code = Array.from(
      { length: 6 },
      () => alphabet[randomInt(alphabet.length)],
    ).join("");
    if (!occupied.has(code)) return code;
  }
  fail("Unable to allocate a room.");
}
