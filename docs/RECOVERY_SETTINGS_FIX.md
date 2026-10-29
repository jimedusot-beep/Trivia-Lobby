# Preserve chosen rules across countdown recovery

A restart during countdown previously discarded validated `packSettings`. Color
Clash then opened with default bot/stacking/timer settings; a selected Whist table
could open as Poker. The explicit checkpoint allowlist now retains this field.
Older checkpoints without it continue to load with existing defaults.

## Current-main integration

Updated PR #81 against main `4f7c3211e91fb1568dd3fa60c3929df87df83b39`.
The sole merge conflict was the appended recovery tests: preserve both the newer
pending-create/join-intent recovery test and the selected-settings regression.
All newer poker/Homeward validation, queue limits, controller, tilt, TV and race
changes remain from main. No duplicate merge of the combined PR #84 is needed.

The runtime change is one explicit field in `party-checkpoint.js`. No schema,
dependency, credential, game rules, private-state projection or deployment change.
The checkpoint remains internal server state; it is not sent directly to guests.

## Validation

- Pre-fix regression demonstrated: removing only the allowlist field made the
  selected-settings test fail with `undefined` instead of the chosen settings.
- JSON checkpoint round-trip preserves Color Clash bot count, stacking and turn
  timer, and the Whist preset; the recovered countdown opens those actual rules.
- A legacy checkpoint with no settings still opens Color Clash with safe defaults.
- Two real-WebSocket tests persist an acknowledged countdown, stop the server,
  advance the clock and resume the host after restart. The same match opens with
  the exact saved Color Clash or Whist settings.
- `npm run check`: passed.
- `npm test`: 115 passed, 0 failed, 0 skipped.
- `cd examples/party-engine && npm test`: 259 passed, 0 failed, 0 skipped.
- `npm run build`: passed with the existing chunk/SVG warnings.
- Focused Chromium `entry-recovery.spec.js`: 8 passed, 0 failed, 0 skipped
  using Chrome for Testing headless shell 156.0.8078.47.
- Diff against the integrated main baseline passes whitespace checks.

Local environment: Linux, Node 24.22.1. Hosted CI, database-backed acceptance and
physical-device checks remain separate gates. No merge into main or deployment.

## Guest-browser CI follow-up

The first updated head `3632d63` passed database/integrated browser acceptance,
production startup, recovery and application checks. Guest-browser jobs failed on
unrelated TV tests: shallow checkouts lacked historical `55414cd`, and Firefox /
WebKit computed the 33.6px font as 33.625px / 33.599998px. No recovery test failed.

The combined candidate incorporates main #106 (`0c0ebfb`) and the exact reviewed
#107 head `55d6e44`. Historical capture is retained as an explicit manual script,
while routine functional browser tests need only current source. Font assertions
use a 0.05px bound; tilt checks retain CSS min-height >=44px and allow only 0.01px
geometry rounding. No controller styling or game rules are relaxed.

This is a branch integration only: neither #107 nor #81 is merged into main by
this work. #107 remains independently reviewable; its commits are preserved as
ancestors, so do not reimplement or duplicate them when releasing the combination.
Once #107 is merged, #81's diff reduces to its recovery-specific files again.
The existing main #106 fetch step is retained; no new workflow change is made.

Validation repeated on this combined tree: typecheck and build passed; 115 root
and 259 guest tests passed with zero failures/skips. Chromium TV catalog, tilt and
entry-recovery suites passed 21/21, zero failures/skips, in 1.1 minutes. Manual
capture script syntax and the diff whitespace check passed. Hosted cross-browser
CI must pass on the newly published head; prior failed runs are not described as
successful. No merge or deployment.
