# Phone controller navigation continuity — Milestone 3

Integration date: 2026-10-30.
Reference: [original PR #108](https://github.com/jimedusot-beep/Trivia-Lobby/pull/108).
Integrated against current `main` `1cce130c67474c537e67c95f0417bf4fd943bac8`, which contains completed [Milestone 1 PR #110](https://github.com/jimedusot-beep/Trivia-Lobby/pull/110). This branch contains only the phone-controller changes originally developed and locally validated in #108, their browser regressions, and this refreshed handoff.

## The bugs

- A focused candidate can vanish when a 20-player nomination screen changes from 844×390 landscape to 320×480 portrait. Page capacity changes, even if the choice-group size stays the same.
- Following a room broadcast, closing the full-prompt dialog can return keyboard focus to Game info rather than the actual opener.
- Nomination buttons in Who's Most Likely and Secret Impostor lose focus after an authoritative room update because they lack stable IDs.

## Behavior introduced

- Preserve the same real DOM task node as the page anchor during viewport recalculation; deliberate Previous/Next actions still change the anchor. No action is submitted merely by rotating or navigating.
- Track the actual help-dialog activation button; preserve stable identities for prompt, round details and Pen tools. Restore focus to an enabled, visible opener after Escape/Back, or use the existing menu fallback.
- Give social nomination buttons stable IDs derived from the server's public candidate player IDs, never nickname text, and reuse existing vote actions. No extra network protocol or state mutation.

## Browser regressions included

Six originally developed Playwright cases cover: focused nomination surviving rotation with exactly one Enter submission; prompt focus return through a host-disconnected broadcast; preserving candidate group through portrait→landscape while menu has focus; Pen tools preferences and Back/Escape return; and 20-player broadcast nomination identity continuity in both Who's Most Likely and Secret Impostor. All verify no unintended action during navigation or broadcast.

The prior PR head `29f2adf68f035b2ce0a8a5b41bd69cfb389379cb` passed local TypeScript, 111 root tests, 259 guest tests, build and 55 focused Chromium phone tests with zero failures/skips. **These are historical local results only**, not verification of the integrated head; hosted full CI, PostgreSQL recovery and Chromium/Firefox/WebKit remain mandatory gates. Existing browser-specific graphics/CDP skips, if any, must be counted and disclosed rather than described as passes.

## Integration boundaries

Current `main` supplies the base tree. Only `examples/party-engine/public/phone-controller.js` and `examples/party-engine/browser-specs/phone-controllers.spec.js` from #108 were applied. All other files are left exactly as in current main. In particular, TV/tilt/browser test corrections, racing fixture fixes and CI history changes from #110 remain unchanged; bounded WebSocket queues from #82 remain in place. No CSS, renderer, host UI, server, schema, auth, game rules, scoring, migrations, dependencies, copied third-party source or assets are changed.

[Milestone 2 PR #81](https://github.com/jimedusot-beep/Trivia-Lobby/pull/81) is now **merged into main** at `1cce130`. This phone PR integrates that checkpoint-only fix and its 68 recovery-test lines via the latest main tree; it does **not** reimplement or remove them. The three-file PR diff remains scoped to the phone controller, its browser regression suite and this note.

## Required follow-up

1. Run all six hosted workflows on this **exact** combined head. Inspect any failed/retried browser journeys and artifacts rather than weakening assertions, adding skips or merely extending timeouts.
2. Review regression behavior for Enter once, correct nominated player ID, correct focus after repeated broadcast, 31-game catalog, pointer/touch behavior and no scrolling at 320px.
3. Validate manually on a real iPhone Safari and Android Chrome, including rotation, soft keyboard and, where relevant, hardware keyboard/switch or assistive technology. Hosted emulation alone cannot prove physical-device behavior.
4. Keep this PR draft and unmerged until review; do not deploy Render or touch production data without separate explicit approval.

Rollback: revert this focused phone controller PR. No database migration required.

## 2026-10-30: PR #81 integrated

Current main `1cce130` includes PR #81's validated countdown checkpoint settings plus Milestone 1 fixes. This update is a two-parent merge onto that main tree, preserving PR #108's original tested phone adapter and six browser regressions. Do not treat earlier passing checks as evidence for the updated head; rerun all six workflows. The existing live Render release is deliberately unchanged. No phone/hardware or production-scale result is claimed.
