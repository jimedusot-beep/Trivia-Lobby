import { createHmac, randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

type Operation = "load" | "save" | "delete" | "prune";
type Transport = "party" | "quiz" | "shared";
type Event = {
  event: "room_checkpoint_failed" | "room_checkpoint_slow";
  operation: Operation; transport: Transport; roomRef?: string;
  durationMs: number; suppressed: number; errorCategory?: string; errorCode?: string;
};
export type CheckpointDiagnosticsOptions = {
  clock?: () => number;
  emit?: (level: "error" | "warn", event: Event) => void;
};

const providerCodes: Record<string, string> = {
  ECONNRESET: "connection", ECONNREFUSED: "connection", EAI_AGAIN: "connection",
  ETIMEDOUT: "timeout", "57014": "timeout", "53300": "capacity",
  "57P01": "connection", "57P02": "connection", "57P03": "connection",
  "08000": "connection", "08001": "connection", "08003": "connection",
  "08004": "connection", "08006": "connection", "08007": "connection", "08P01": "connection",
  "40001": "conflict", "40P01": "conflict",
};
const internalMessages: Record<string, string> = {
  "Room checkpoint conflict": "conflict",
  "Room checkpoint too large": "payload_limit",
  "Room checkpoint capacity reached": "capacity",
  "Checkpoint expiry is invalid": "invalid_expiry",
  "Query read timeout": "timeout",
  "Connection terminated due to connection timeout": "timeout",
};
function classify(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const code = candidate?.code;
  if (typeof code === "string" && Object.hasOwn(providerCodes, code))
    return { errorCategory: providerCodes[code], errorCode: code };
  const message = candidate?.message;
  return { errorCategory: typeof message === "string" && Object.hasOwn(internalMessages, message)
    ? internalMessages[message] : "unknown" };
}

/** Fixed operation/transport buckets, independent of untrusted room codes. */
export class RoomCheckpointDiagnostics {
  private salt = randomBytes(32);
  private buckets = new Map<string, { at: number; suppressed: number }>();
  private clock: () => number;
  private emit: NonNullable<CheckpointDiagnosticsOptions["emit"]>;
  constructor(options: CheckpointDiagnosticsOptions = {}) {
    this.clock = options.clock ?? (() => performance.now());
    this.emit = options.emit ?? ((level, event) => console[level](JSON.stringify({ level, ...event })));
  }
  private report(event: Event, at: number) {
    const key = `${event.event}:${event.transport}:${event.operation}`;
    const previous = this.buckets.get(key);
    if (previous && at - previous.at < 30000) { previous.suppressed++; return; }
    event.suppressed = previous?.suppressed ?? 0;
    this.buckets.set(key, { at, suppressed: 0 });
    this.emit(event.event === "room_checkpoint_failed" ? "error" : "warn", event);
  }
  async run<T>(operation: Operation, transport: Transport, roomCode: string | undefined, work: () => Promise<T>): Promise<T> {
    const start = this.clock();
    let failed = false, originalError: unknown;
    try { return await work(); }
    catch (error) { failed = true; originalError = error; throw error; }
    finally {
      // Diagnostics must never turn a committed write into an apparent failure.
      try {
        const end = this.clock(), durationMs = Math.max(0, Math.round(end - start));
        if (failed || durationMs >= 250) this.report({
          event: failed ? "room_checkpoint_failed" : "room_checkpoint_slow", operation, transport,
          ...(roomCode ? { roomRef: createHmac("sha256", this.salt).update(roomCode).digest("hex").slice(0, 16) } : {}),
          durationMs, suppressed: 0, ...(failed ? classify(originalError) : {}),
        }, end);
      } catch { /* A log sink failure cannot change the storage contract. */ }
    }
  }
}
