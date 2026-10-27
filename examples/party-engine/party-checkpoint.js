import { Party } from "./engine.js";
import { Chess } from "chess.js";

// Explicit engine fields. Functions, socket bindings and arbitrary future properties never persist.
const fields = ["quizMs", "writeMs", "voteMs", "countdownMs", "charadesMs", "raceMs", "raceLaps", "quiz", "quizTitle", "show",
  "players", "championship", "hostConnected", "phase", "mode", "revision", "matchId", "index", "deadline", "touched",
  "requests", "interrupted", "endedByHost", "hostWaitAt", "roster", "pack", "category", "pairs", "turn", "answers", "responses",
  "votes", "options", "skipped", "social", "bonus", "bonusBingo", "bonusBracket"];

function encode(value) {
  // chess.js instances contain methods and non-enumerable state; serialize
  // replayable legal history, not its object internals. Replaying moves also
  // preserves repetition history that FEN alone would lose.
  if (value instanceof Chess) return { $chess: { moves: value.history(), fen: value.fen() } };
  if (value instanceof Map) return { $map: [...value].map(([k, v]) => [k, encode(v)]) };
  if (value instanceof Set) return { $set: [...value].map(encode) };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  return value;
}
function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    if (Object.keys(value).length === 1 && value.$chess) {
      const saved = value.$chess;
      if (!saved || !Array.isArray(saved.moves) || saved.moves.length > 4096 ||
        !saved.moves.every(move => typeof move === "string" && move.length <= 32) ||
        typeof saved.fen !== "string" || saved.fen.length > 128)
        throw new Error("Unsupported chess recovery state.");
      const chess = new Chess();
      for (const move of saved.moves) chess.move(move);
      if (chess.fen() !== saved.fen) throw new Error("Unsupported chess recovery state.");
      return chess;
    }
    if (Object.keys(value).length === 1 && Array.isArray(value.$map)) return new Map(value.$map.map(([k, v]) => [k, decode(v)]));
    if (Object.keys(value).length === 1 && Array.isArray(value.$set)) return new Set(value.$set.map(decode));
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}
export function snapshotParty(party) {
  return Object.fromEntries(fields.filter(key => Object.hasOwn(party, key)).map(key => [key, encode(party[key])]));
}
export function restoreParty(code, state, options, savedAt) {
  if (!state || !fields.every(key => key !== "players" || Object.hasOwn(state, key))) throw new Error("Unsupported room recovery state.");
  const party = new Party(code, options);
  for (const key of fields) if (Object.hasOwn(state, key)) party[key] = decode(state[key]);
  if (!(party.players instanceof Map) || party.players.size > 20 || !(party.requests instanceof Map)
    || party.requests.size > 4096 || !Number.isSafeInteger(party.revision) || !Number.isFinite(party.touched)
    || !["lobby", "countdown", "question", "clue", "writing", "voting", "acting", "playing", "reveal", "finished"].includes(party.phase))
    throw new Error("Unsupported room recovery state.");
  // Never discard an active open-pack game or reset its score on recovery.
  if (["playing", "reveal"].includes(party.phase) && ["race", "tap", "no-say", "feud", "draw", "colors", "four", "chess", "checkers", "reversi", "mancala", "table", "backgammon"].includes(party.mode)
    && (!party.pack || typeof party.pack !== "object" || Array.isArray(party.pack)))
    throw new Error("Unsupported room recovery state.");
  if (party.mode === "race" && party.pack?.kind === "race" && (!Array.isArray(party.pack.karts) || party.pack.karts.length !== party.players.size))
    throw new Error("Unsupported racing recovery state.");
  // Restore the same season-within-room standings and completed-match IDs.
  // A newly initialized championship is valid for older version-1 checkpoints.
  if (!(party.championship?.entries instanceof Map) || party.championship.entries.size > 20 ||
      !Array.isArray(party.championship.games) || party.championship.games.length > 40 ||
      !(party.championship.completed instanceof Set) || party.championship.completed.size > 80)
    throw new Error("Unsupported championship recovery state.");
  if (party.mode === "tap" && party.pack?.kind === "tap" &&
      (!Array.isArray(party.pack.racers) || party.pack.racers.length !== party.players.size))
    throw new Error("Unsupported Tap Dash recovery state.");
  if (party.mode === "no-say" && ["playing","reveal"].includes(party.phase)) {
    const s=party.pack;
    if (!s || s.kind!=="forbidden" || !Array.isArray(party.roster) ||
        !party.roster.includes(s.giver) || !party.roster.includes(s.referee) ||
        s.giver===s.referee ||
        !Number.isSafeInteger(s.cursor) || s.cursor<0 || s.cursor>5 ||
        !Array.isArray(s.history) || s.history.length>5 ||
        !Number.isSafeInteger(s.finishedCards) || s.finishedCards!==s.history.length)
      throw new Error("Unsupported Forbidden Word Frenzy recovery state.");
  }
  const hostWasConnected = party.hostConnected;
  party.hostConnected = false;
  for (const player of party.players.values()) player.connected = false;
  // A healthy host may have been idle since the last checkpoint. That write time
  // is not its disconnect time. Preserve an existing absence, or start recovery grace now.
  if (!party.deadline && party.phase !== "finished" && party.hostWaitAt === null)
    party.hostWaitAt = hostWasConnected ? party.clock() : savedAt;
  return party;
}
