import type { Pool } from "pg";
import { RoomCheckpointDiagnostics, type CheckpointDiagnosticsOptions } from "./room-checkpoint-diagnostics";

export type RoomKind = "party" | "quiz";
export type RoomCheckpoint = { state: any; version: number; expiresAt: number; savedAt: number };
export interface RoomCheckpointStore {
  load(kind: RoomKind, code: string): Promise<RoomCheckpoint | null>;
  save(kind: RoomKind, code: string, state: unknown, expiresAt: number, expectedVersion: number | null): Promise<number>;
  delete(kind: RoomKind, code: string, expectedVersion?: number): Promise<void>;
  prune(): Promise<void>;
}

export const ROOM_CHECKPOINT_LIMITS = { maxRoomBytes: 4 * 1024 * 1024, maxTotalBytes: 32 * 1024 * 1024, maxRooms: 700 };
type Limits = Partial<typeof ROOM_CHECKPOINT_LIMITS> & { clock?: () => number };

/** Test/standalone adapter: copies at the persistence boundary just as PostgreSQL does. */
export class MemoryRoomCheckpointStore implements RoomCheckpointStore {
  private entries = new Map<string, RoomCheckpoint & { bytes: number }>();
  private limits: typeof ROOM_CHECKPOINT_LIMITS;
  private clock: () => number;
  private generation = 0;
  constructor(options: Limits = {}) {
    this.limits = { ...ROOM_CHECKPOINT_LIMITS, ...options };
    this.clock = options.clock ?? Date.now;
  }
  async load(kind: RoomKind, code: string) {
    await this.prune();
    const entry = this.entries.get(`${kind}:${code}`);
    return entry ? structuredClone(entry) : null;
  }
  async save(kind: RoomKind, code: string, state: unknown, expiresAt: number, expectedVersion: number | null) {
    await this.prune();
    const text = JSON.stringify(state), bytes = Buffer.byteLength(text);
    if (bytes > this.limits.maxRoomBytes) throw new Error("Room checkpoint too large");
    if (!Number.isFinite(expiresAt) || expiresAt <= this.clock()) throw new Error("Checkpoint expiry is invalid");
    const key = `${kind}:${code}`, previous = this.entries.get(key);
    if ((previous?.version ?? null) !== expectedVersion) throw new Error("Room checkpoint conflict");
    let total = bytes;
    for (const [id, entry] of this.entries) if (id !== key) total += entry.bytes;
    if (total > this.limits.maxTotalBytes || (!previous && this.entries.size >= this.limits.maxRooms))
      throw new Error("Room checkpoint capacity reached");
    const version = ++this.generation;
    this.entries.set(key, { state: JSON.parse(text), version, expiresAt, savedAt: this.clock(), bytes });
    return version;
  }
  async delete(kind: RoomKind, code: string, expectedVersion?: number) {
    const key = `${kind}:${code}`, entry = this.entries.get(key);
    if (expectedVersion === undefined || entry?.version === expectedVersion) this.entries.delete(key);
  }
  async prune() {
    for (const [key, entry] of this.entries) if (entry.expiresAt <= this.clock()) this.entries.delete(key);
  }
}

/** One database round trip per commit; the SQL function owns atomic fencing and budgets. */
export class PostgresRoomCheckpointStore implements RoomCheckpointStore {
  private diagnostics: RoomCheckpointDiagnostics;
  constructor(private pool: Pick<Pool, "query">, diagnostics: CheckpointDiagnosticsOptions = {}) {
    this.diagnostics = new RoomCheckpointDiagnostics(diagnostics);
  }
  async load(kind: RoomKind, code: string): Promise<RoomCheckpoint | null> {
    return this.diagnostics.run("load", kind, code, async () => {
      const result = await this.pool.query(
        "SELECT state, version, expires_at, updated_at FROM live_room_checkpoints WHERE kind=$1 AND code=$2 AND expires_at > clock_timestamp()",
        [kind, code],
      );
      const row = result.rows[0];
      return row ? { state: row.state, version: Number(row.version), expiresAt: new Date(row.expires_at).getTime(), savedAt: new Date(row.updated_at).getTime() } : null;
    });
  }
  async save(kind: RoomKind, code: string, state: unknown, expiresAt: number, expectedVersion: number | null) {
    return this.diagnostics.run("save", kind, code, async () => {
      const text = JSON.stringify(state);
      if (Buffer.byteLength(text) > ROOM_CHECKPOINT_LIMITS.maxRoomBytes) throw new Error("Room checkpoint too large");
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error("Checkpoint expiry is invalid");
      const result = await this.pool.query(
        "SELECT save_live_room_checkpoint($1,$2,$3::jsonb,$4::timestamptz,$5::bigint) AS version",
        [kind, code, text, new Date(expiresAt), expectedVersion],
      );
      return Number(result.rows[0].version);
    });
  }
  async delete(kind: RoomKind, code: string, expectedVersion?: number) {
    return this.diagnostics.run("delete", kind, code, async () => {
      await this.pool.query("DELETE FROM live_room_checkpoints WHERE kind=$1 AND code=$2 AND ($3::bigint IS NULL OR version=$3)", [kind, code, expectedVersion ?? null]);
    });
  }
  async prune() {
    return this.diagnostics.run("prune", "shared", undefined, async () => {
      await this.pool.query("DELETE FROM live_room_checkpoints WHERE expires_at <= clock_timestamp()");
    });
  }
}
