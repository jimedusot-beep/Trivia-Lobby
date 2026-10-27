# Multiplayer reliability implementation plan

> **For agentic workers:** Use superpowers:executing-plans and test-driven-development; perform a fresh whole-branch review before delivery.

**Goal:** Recover authoritative games after restarts and make phone reconnects and action retries reliable.

**Architecture:** Both existing transports keep their engines and wire compatibility. A shared private checkpoint store provides optimistic writes and bounded retention. Serialize each room's operations and defer network output until its durable write succeeds; restore state without restoring network connections.

**Tech Stack:** Existing Node.js, ws, React, PostgreSQL/pg and node:test. No added runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-26-multiplayer-reliability.md`

## Global Constraints

- Preserve all existing games, private-deck authorization and QR guest entry.
- Keep hosting and services free; no resource creation, upgrades or deployment in this implementation pass.
- Never persist raw credentials or broadcast internal room state.
- Checkpoints: ten-minute idle expiry, 4 MiB per payload, 32 MiB total active payload, 700 active room records maximum.
- Retain legacy v1 quiz clients while adding optional action metadata.

## Review Focus

- Database failure after an in-memory mutation must expose no uncommitted score/ack.
- A replaced connection's delayed close must not disconnect its replacement.
- Recovery must preserve private assignments and nested Map/Set values.
- Repeated retries at deadline boundaries must never apply scoring twice.
- A shared household IP must admit a host and 20 reconnecting players.

### Task 1: Private checkpoint store and transaction delivery

**Files:** `server/room-checkpoints.ts`, `migrations/0009_live_room_checkpoints.sql`, `script/migrations.ts`, `examples/party-engine/durable-delivery.js`, `tests/room-checkpoints.test.ts`, `tests/room-checkpoints.integration.test.ts`.

**Interfaces:** `RoomCheckpointStore.load(kind, code)` returns `{state, version, expiresAt, savedAt}` or null; `save(kind, code, state, expiresAt, expectedVersion)` returns the new numeric version; `delete(kind,code)` and `prune()` remove expired state. `kind` is `party | quiz`. `withDeferredDelivery(operation, commit)` releases `deliver(effect)` callbacks only after successful commit.

- [x] Write failing tests for create/load, detached state, conflict rejection, expiry, payload budgets and deferred delivery failure.
- [x] Run the tests and confirm the missing behavior fails.
- [x] Implement memory test store and real PostgreSQL adapter; add additive migration and production wiring.
- [x] Verify unit and actual PostgreSQL behavior, including concurrent writers and capacity.

### Task 2: Guest party recovery

**Files:** `examples/party-engine/party-checkpoint.js`, `sessions.js`, `transport.js`, `transport.d.ts`, `server/guest-party.ts`, `tests/party-recovery.test.ts`.

**Interfaces:** `attachPartySocket` accepts optional `checkpointStore`; standalone/test use remains in memory. Snapshot/restore exports reconstruct Party state and hashed ParticipantSessions while excluding sockets/functions. Production passes the shared PostgreSQL store.

- [x] Write restart, nested Bingo state, secret-role, ack-loss replay, expired-deadline and write-failure tests; observe failures.
- [x] Implement allowlisted state conversion, per-room queues, lazy recovery and deferred output.
- [x] Verify existing party engine/network suites and shared-IP twenty-player reconnect scenario.

### Task 3: Quiz transport recovery and command replay

**Files:** `server/live-game.ts`, `shared/game-protocol.ts`, `shared/schema.ts`, `server/routes.ts`, `tests/live-recovery.test.ts`.

**Interfaces:** `attachGameSocket` accepts `checkpointStore`. Optional `requestId`, `matchId`, `revision` accompany commands; server events convey match/phase metadata and `action_ack`. Existing event payloads remain compatible.

- [x] Write restart, original acknowledgment replay, changed-ID rejection, host-next duplication, deadline and failed-save tests; observe failures.
- [x] Implement private snapshots, lazy restore, fenced writes, serialized commands/timers, heartbeat and slow-client limits.
- [x] Verify existing multiplayer and scoring suites.

### Task 4: Phone connection recovery

**Files:** `examples/party-engine/public/connection-recovery.js`, `public/app.js`, `client/src/hooks/use-game-socket.ts`, relevant browser scenarios.

**Interfaces:** A browser-native shared connection helper owns capped backoff, heartbeat/online/foreground recovery and connection generation checks; query/party clients preserve their credentials and role-specific wire protocol.

- [x] Add behavior tests for delayed authentication, transient offline and replaced sessions; observe failures.
- [x] Implement bounded jittered reconnects and safe pending-command retry, with readiness only after snapshot.
- [x] Verify mobile/browser flows, type checks and production asset packaging.

### Task 5: Integration, evidence and review

- [x] Run full app and party suites, TypeScript, build, PostgreSQL integration and relevant browser/load scenarios.
- [x] Record measured twenty-player shared-IP results and manual phone acceptance steps in `docs/MULTIPLAYER_RELIABILITY.md`.
- [x] Obtain an independent whole-branch review, fix substantive findings with regression tests, then create the pull request.

## Execution ledger

- Baseline: branch isolated from `c88f542`; no existing work changed. Dependency install completed.
- Authorization: the user's instruction to implement these aspects approves this reliability scope; routine implementation decisions proceed without another approval round.
- Task 1: storage/deferred-delivery unit tests passed after observed failures, including stale-writer and expired-code generation fencing. Actual PostgreSQL 16/18 checks and the built production-runtime restart scenario passed in CI on the initial implementation; no production database is used for tests.
- Task 2: restart, failed writes, secret-preserving Bingo state, expired deadlines and twenty-player shared-IP recovery tests implemented and passing.
- Task 3: quiz checkpoints, replayed actions, lost rotated-credential responses, report repair and repeated twenty-player reconnects implemented. A regression test caught early reveal when only one disconnected participant returned; preserve the entire question roster until its original deadline.
- Task 4: browser lifecycle tests and all 45 guest browser scenarios passed, including dropped acknowledgments and restored connectivity. Type checks and the production build passed before the final backend regression correction.
- Task 5: the independent whole-branch review found three Important issues and no Critical or Minor findings. Six regression cases reproduced healthy-host grace expiry, rapid lobby edits and stranded original sockets on failed replacement. All six passed after focused corrections, along with 98 app tests, 90 party tests, TypeScript and the production build. The host form now reconciles authoritative settings; browser regression coverage includes reload and restored connectivity. The initial integrated browser run also caught a reconnect-status copy regression, reproduced locally and fixed while retaining existing expectations.
- Final CI revalidation and current check results are recorded in [PR #66](https://github.com/jimedusot-beep/Trivia-Lobby/pull/66). Real-phone testing remains a manual acceptance step. No merge, deployment or service upgrade is part of this change.
