# Countdown recovery: preserve selected game rules

Milestone 2 integration — 2026-10-30.

## Problem and minimal fix

A server restart during a countdown could discard the validated `packSettings` for the selected game. Color Clash then fell back to the wrong bots, stacking or timer; Whist could open with Poker rules.

The existing fix from [PR #81](https://github.com/jimedusot-beep/Trivia-Lobby/pull/81) adds only `packSettings` to the explicit checkpoint field allowlist in `examples/party-engine/party-checkpoint.js`. The checkpoint remains private server state. No protocol, schema, dependencies, deployment configuration, scoring, or extra networking engine is added.

## Integration with Milestone 1

This branch now combines latest `main` `b255470fa93357fc4c0e13d713377ef4bde6ba1c` (including [PR #110](https://github.com/jimedusot-beep/Trivia-Lobby/pull/110)) with PR #81's recovery-specific runtime fix and tests only. It intentionally **does not** replay the superseded TV/tilt files, capture script, or #107/#109 history. The merged Milestone 1 browser fixes, the bounded input queues from #82, the existing 31 games, QR entry, the original host UI, and current database migrations are preserved.

Do not merge historical combined [PR #84](https://github.com/jimedusot-beep/Trivia-Lobby/pull/84) wholesale: its queue and Grand Prix changes overlap commits already on `main`. Evaluate only genuinely missing recovery compatibility scenarios separately.

## Regression coverage

`tests/party-recovery.test.ts` already includes:
- JSON checkpoint round-trips for custom Color Clash rules and the Whist preset.
- Fallback to safe defaults for legacy snapshots without the field.
- Two actual WebSocket server-restart tests that commit the countdown, wait for acknowledgment, restart and advance time, resume the host, and confirm that the original match and saved rules survive.
- All preexisting create/join/recovery tests retained.

The original PR's earlier local evidence was 115 root application tests, 259 standalone tests, TypeScript and build passing; **those results predate this merge and must not be reported as verification of the new head**. Required gates for this integrated branch: root CI, standalone guest engine plus Chromium/Firefox/WebKit browsers, PostgreSQL 16/18 recovery, production artifact startup/restart, encrypted backup fixture, local WebSocket evidence, and Render blueprint checks.

## Remaining work and limitations

- Inspect all CI results on this PR's exact new SHA before approval.
- Synthetic or in-memory server restart testing is not a physical-phone test or production-capacity guarantee.
- Live Render still requires separate explicit deployment approval and release validation.
- No live database mutation, paid resource creation, or production deployment is part of this integration.
