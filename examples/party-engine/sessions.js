import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
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
    if (old !== ws) old?.close(1000, "Reconnected elsewhere");
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
        entry.ws?.close(1000, "Participant removed");
      }
  }
  closeAll(reason = "Room expired") {
    for (const entry of this.#entries.values()) entry.ws?.close(1000, reason);
  }
  *connections() {
    for (const [id, entry] of this.#entries) if (entry.ws) yield [id, entry.ws];
  }
}
