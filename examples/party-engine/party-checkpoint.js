import { Party } from "./engine.js";

// Explicit engine fields. Functions, socket bindings and arbitrary future properties never persist.
const fields = ["quizMs", "writeMs", "voteMs", "countdownMs", "charadesMs", "quiz", "quizTitle",
  "players", "hostConnected", "phase", "mode", "revision", "matchId", "index", "deadline", "touched",
  "requests", "interrupted", "hostWaitAt", "roster", "category", "pairs", "turn", "answers", "responses",
  "votes", "options", "skipped", "social", "bonus", "bonusBingo", "bonusBracket"];

function encode(value) {
  if (value instanceof Map) return { $map: [...value].map(([k, v]) => [k, encode(v)]) };
  if (value instanceof Set) return { $set: [...value].map(encode) };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  return value;
}
function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
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
    || !["lobby", "countdown", "question", "clue", "writing", "voting", "acting", "reveal", "finished"].includes(party.phase))
    throw new Error("Unsupported room recovery state.");
  const hostWasConnected = party.hostConnected;
  party.hostConnected = false;
  for (const player of party.players.values()) player.connected = false;
  // A healthy host may have been idle since the last checkpoint. That write time
  // is not its disconnect time. Preserve an existing absence, or start recovery grace now.
  if (!party.deadline && party.phase !== "finished" && party.hostWaitAt === null)
    party.hostWaitAt = hostWasConnected ? party.clock() : savedAt;
  return party;
}
