# Racing Observability Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make hidden checkpoint failures visible and measure live racing delays.

**Architecture:** Instrument the existing PostgreSQL checkpoint store; exercise the existing guest racing protocol with an opt-in bounded probe.

**Tech Stack:** TypeScript, Node test runner, PostgreSQL adapter, Python 3, websockets 16.

**Spec:** `docs/superpowers/specs/2026-10-27-racing-observability-design.md`

## Global Constraints
- Preserve existing game behavior and acknowledgement ordering.
- No raw errors, private data, credentials or connection strings in logs/results.
- At most 20 controllers, 20 inputs/sec each, 60 seconds per live sample.
- No new games, schema changes, resources or fees.

## Review Focus
- Database failures must still reject with the original exception.
- A broken log sink must not disconnect a healthy game.
- Repeated failures must not create an unbounded log/map.
- Input echo measurements must account for superseded sequences.
- Socket/setup failures must close all probe clients and report incomplete evidence.

### Task 1: Instrument checkpoint operations
- [ ] Add failing tests to `tests/room-checkpoints.test.ts` for safe error logs on party/quiz calls, slow writes, repeated failures and log-sink failures.
- [ ] Run the focused tests and verify failures reflect missing diagnostics.
- [ ] Add `server/room-checkpoint-diagnostics.ts`; wrap load/save/delete/prune in `PostgresRoomCheckpointStore` with a typed optional diagnostics dependency.
- [ ] Run focused tests, full app/party suites, typecheck and build; commit.

### Task 2: Measure racing
- [ ] Write metric/bounds tests for `script/measure-racing.py`; verify RED, then implement the probe.
- [ ] Exercise the probe against the real local guest server, then run bounded 10- and 20-controller Render samples.
- [ ] Document results and limits in `docs/RACING_OBSERVABILITY.md`; review the complete diff and publish a focused PR.
