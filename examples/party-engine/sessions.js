import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { deliver } from "./durable-delivery.js";
const hash = (token) => createHash("sha256").update(token).digest();
/** Secret credentials and socket ownership never belong in public game state. */
export class ParticipantSessions {
  #entries = new Map();
  issue(actor, ws) {
    if (this.#entries.has(actor))
      throw new Error("Participant already has a session.");
    const token = randomBytes(32).toString("base64url");
    this.#entries.set(actor, { tokenHash: hash(token), ws });
    return token;
  }
  resume(actor, token, ws) {
    const entry = this.#entries.get(actor);
    if (
      typeof token !== "string" ||
      token.length > 128 ||
      !entry ||
      !timingSafeEqual(hash(token), entry.tokenHash)
    )
      throw new Error("Invalid reconnect credential.");
    const old = entry.ws;
    entry.ws = ws;
    if (old !== ws) deliver(() => old?.close(1000, "Reconnected elsewhere"));
  }
  owns(actor, ws) {
    return this.#entries.get(actor)?.ws === ws;
  }
  disconnect(actor, ws) {
    if (!this.owns(actor, ws)) return false;
    this.#entries.get(actor).ws = null;
    return true;
  }
  prune(players) {
    for (const [id, entry] of this.#entries)
      if (id !== "host" && !players.has(id)) {
        this.#entries.delete(id);
        deliver(() => entry.ws?.close(1000, "Participant removed"));
      }
  }
  closeAll(reason = "Room expired") {
    for (const entry of this.#entries.values()) entry.ws?.close(1000, reason);
  }
  snapshot() {
    return [...this.#entries].map(([actor, entry]) => ({ actor, tokenHash: entry.tokenHash.toString("hex") }));
  }
  static restore(rows) {
    if (!Array.isArray(rows) || rows.length > 21) throw new Error("Unsupported room credentials.");
    const sessions = new ParticipantSessions();
    for (const row of rows) {
      if (!row || typeof row.actor !== "string" || !(row.actor === "host" || /^[\da-f-]{36}$/i.test(row.actor))
        || !/^[\da-f]{64}$/i.test(row.tokenHash) || sessions.#entries.has(row.actor)) throw new Error("Unsupported room credentials.");
      sessions.#entries.set(row.actor, { tokenHash: Buffer.from(row.tokenHash, "hex"), ws: null });
    }
    return sessions;
  }
  *connections() {
    for (const [id, entry] of this.#entries) if (entry.ws) yield [id, entry.ws];
  }
}
