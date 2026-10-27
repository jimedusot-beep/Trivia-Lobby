# Reliability and performance compatibility review

This review combines three existing proposals on an isolated branch. It does not
change `main`, close the original PRs, or deploy to Render.

| Source | Pinned head | Behavior |
| --- | --- | --- |
| [#81](https://github.com/jimedusot-beep/Trivia-Lobby/pull/81) | `d1461299f09cdfc8c18da006b32f529a90eef38d` | Preserve chosen game settings across countdown recovery. |
| [#82](https://github.com/jimedusot-beep/Trivia-Lobby/pull/82) | `9332f06eadc41c315d360bec4e74064d8e81d080` | Bound pending ordinary socket messages during slow checkpoints. |
| [#83](https://github.com/jimedusot-beep/Trivia-Lobby/pull/83) | `f021d3f83170241b1fe0650172c3f940a0cd4353` | Precompute track geometry while preserving projection results. |

Baseline: `b4f58ebd3a068157e2e7317356290c482746a96e`. All three proposals
combined without conflicts. No new production changes were needed for compatibility.

## Added acceptance coverage

The real-WebSocket recovery suite now exercises Color Clash with two bots,
stacking and a 60-second turn timer, Whist, and Grand Prix. Each case pauses the
start checkpoint, queues a retry behind it, verifies there is no premature ACK
and the saved state remains in the lobby, then releases the save. The server
restarts after countdown expiration. The same credential and match ID recover,
selected rules remain in effect, scores stay zero, and replaying the original
request after recovery does not restart or rescore the match. Grand Prix also
produces a finite-coordinate frame through the optimized simulation path.

The existing backlog tests exercise count/byte overflow and 20 synthetic clients
sharing a delayed checkpoint. The geometry oracle checks exact equivalence to the
released algorithm, including seam/tie and non-finite inputs.

## Local verification

- Clean root and standalone dependency installs completed.
- TypeScript check and production build passed.
- All 199 guest-engine/network tests passed, with zero skips.
- All 114 application tests passed, including the three new integration cases, with zero skips.
- Local benchmark: 20,480 queries per round, seven alternating-order rounds;
  median 239.63 ms before and 41.04 ms after, or 5.84x projection throughput.
  This is local function CPU evidence, not whole-game or production latency.
- System Chromium could not launch because process-singleton sockets are blocked
  by this workspace. Playwright's browser download was also truncated. Local
  browser assertions therefore have not been verified for this combined branch.

## Release gate

Run the existing GitHub CI on the combined head: root and guest suites, production
runtime, PostgreSQL checkpoints, simulated load, and Chromium/Firefox/WebKit
journeys. Record those run links before treating combined acceptance as complete.
Prior green runs on the three separate PRs are not proof of the combined branch.
Keep this work unmerged and undeployed until the user approves a concrete release.

Physical phone steering, camera QR scans and real Wi-Fi tests remain separate
checks. The scheduled production backup job is opt-in; a skipped backup job is
not evidence that private production files have been backed up or restored.
