import { randomInt, randomUUID } from "node:crypto";
import { quiz as demoQuiz, prompts } from "./content.js";
import { validateAction } from "./protocol.js";
import { makeTurn, markClue, finishTurn } from "./charades.js";
import { projectParty } from "./projections.js";
import { socialModes, socialPackLength, openSocial, openSocialVoting, acceptSocial, scoreSocial } from "./social-games.js";
import { bonusModes, bonusRoundCount, openBonus, openBonusVoting, acceptBonus, scoreBonus } from "./bonus-games.js";
import { packIds, packMin, validatePackSettings, openPack, tickPack, acceptPack, nextPack } from "./open-pack/index.js";
import { defaultShow } from "./open-pack/feud.js";
import { raceModes, openRace, tickRace, acceptRace } from "./racing.js";
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
      customQuiz,
      customShow,
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
    // The host can supply a bounded original guest quiz at room creation.
    this.quiz = customQuiz?.questions ?? demoQuiz;
    this.quizTitle = customQuiz?.title ?? "Sample Quiz";
    this.show = customShow ?? defaultShow;
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
    if (this.players.size >= 20) fail("Room full (20 players maximum).");
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
    if (this.phase === "racing") tickRace(this);
    if (this.deadline !== null && this.clock() >= this.deadline) {
      if (this.phase === "playing" && packIds.includes(this.mode)) tickPack(this);
      else if (this.phase === "countdown") this.open();
      else if (this.phase === "clue") openSocialVoting(this);
      else if (this.phase === "writing") {
        if (bonusModes.includes(this.mode)) openBonusVoting(this);
        else { this.index = 0; this.openVote(); }
      } else if (["question", "voting", "acting"].includes(this.phase))
        this.closeRound();
    }
    if (this.hostWaitAt !== null && this.clock() - this.hostWaitAt >= 60000) {
      this.interrupted = true;
      this.enter("finished");
    }
  }
  open() {
    if (raceModes.includes(this.mode)) { openRace(this); return; }
    if (packIds.includes(this.mode)) { openPack(this); return; }
    if (this.mode === "charades") {
      this.turn = makeTurn(this.roster[this.index], this.category);
      this.enter("acting", this.charadesMs);
      return;
    }
    if (socialModes.includes(this.mode)) {
      openSocial(this);
    } else if (bonusModes.includes(this.mode)) {
      openBonus(this);
    } else if (this.mode === "quiz") {
      this.answers = new Map();
      this.enter("question", this.quiz[this.index].seconds !== undefined ? this.quiz[this.index].seconds * 1000 : this.quizMs);
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
        if (answer === this.quiz[this.index].correct) {
          const p = this.players.get(id);
          p.score += this.quiz[this.index].points ?? 100;
          p.correct++;
        } else {
          const p = this.players.get(id);
          p.score = Math.max(0, p.score - (this.quiz[this.index].penalty ?? 0));
        }
    } else if (this.mode === "duel") {
      for (const optionId of this.votes.values()) {
        const option = this.options.find((o) => o.id === optionId);
        this.players.get(option.author).score += 100;
      }
    }
    if (socialModes.includes(this.mode)) scoreSocial(this);
    if (bonusModes.includes(this.mode)) scoreBonus(this);
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
      if (!["quiz", "duel", "charades", ...socialModes, ...bonusModes, ...packIds, ...raceModes].includes(msg.value))
        fail("Unknown game mode.");
      // Validate before pruning: a rejected start must not revoke a disconnected
      // participant's reconnect access while the party is still in the lobby.
      const activePlayers = [...this.players.values()].filter(
        (p) => p.connected,
      );
      const minimum = packMin(msg.value);
      if (activePlayers.length < minimum || activePlayers.length > 20)
        fail(`Start with ${minimum}–20 connected players.`);
      const settings = validatePackSettings(msg.value, msg.settings);
      if (msg.value === "table" && settings.preset === "whist" && activePlayers.length < 4)
        fail("Whist needs four connected players.");
      for (const [id, p] of this.players)
        if (!p.connected) this.players.delete(id);
      this.mode = msg.value;
      this.packSettings = settings;
      this.pack = null;
      this.endedByHost = false;
      this.category = msg.category ?? "actions";
      this.matchId = randomUUID();
      this.index = 0;
      this.interrupted = false;
      this.roster = [...this.players.keys()];
      this.bonusBingo = null;
      this.bonusBracket = null;
      this.players.forEach((p) => {
        p.score = 0;
        p.correct = 0;
      });
      this.pairs = this.roster.map((id, i) => ({
        prompt: prompts[i % prompts.length],
        authors: [id, this.roster[(i + 1) % this.roster.length]],
      }));
      this.enter("countdown", this.countdownMs);
    } else if (msg.type === "play") {
      if (raceModes.includes(this.mode)) acceptRace(this,actor,msg.value);
      else acceptPack(this, actor, msg.value);
    } else if (msg.type === "respond") {
      if (bonusModes.includes(this.mode)) acceptBonus(this,actor,msg);
      else acceptSocial(this,actor,msg);
    } else if (msg.type === "answer") {
      if (
        actor === "host" ||
        this.mode !== "quiz" ||
        this.phase !== "question" ||
        this.answers.has(actor)
      )
        fail("Cannot submit another answer now.");
      if (!Number.isInteger(msg.value) || msg.value < 0 || msg.value >= this.quiz[this.index].choices.length)
        fail("Invalid choice.");
      this.answers.set(actor, msg.value);
      if (this.answers.size === this.roster.length) this.closeRound();
    } else if (msg.type === "write") {
      if (actor === "host" || this.mode !== "duel" || this.phase !== "writing")
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
        this.mode !== "duel" ||
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
      if (packIds.includes(this.mode)) { nextPack(this); }
      else if (raceModes.includes(this.mode)) { this.enter("finished"); }
      else {
      const total =
        bonusModes.includes(this.mode) ? bonusRoundCount[this.mode] :
        socialModes.includes(this.mode) ? socialPackLength :
        this.mode === "quiz"
          ? this.quiz.length
          : this.mode === "charades"
            ? this.roster.length
            : this.pairs.length;
      if (++this.index >= total) this.enter("finished");
      else if (this.mode === "charades")
        this.enter("countdown", this.countdownMs);
      else if (this.mode === "quiz" || socialModes.includes(this.mode) || bonusModes.includes(this.mode)) this.open();
      else this.openVote();
      }
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
