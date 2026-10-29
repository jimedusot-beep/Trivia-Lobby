# Phone device-readiness follow-up

This extends Agent 03's PR #97 at `197420d`, on unchanged main `55414cd`.
The experiment branch is `feature/gx2-phone-device-readiness`; the reviewed result
is added to the existing phone PR, not merged into main or deployed. TV PR #96,
source audit #95 and planning #94 are separate. Tilt #93 remains unmerged.

## Reproduced conditions

| Condition | Before | Fix |
| --- | --- | --- |
| Prompt Duel, 390×844 layout, 260px simulated keyboard viewport, 47px top / 34px bottom safe insets | Lock response crossed the play-area boundary | In a short keyboard viewport, temporarily remove the secondary pager, keep one private-prompt line, and retain the accessible field label without taking up visual space |
| Color Clash, 568×320 with 44px left/right and 21px bottom insets | The select rose above the play-area boundary; Draw wrapped into a tall, narrow button | Give a single-action group the available width; hand, color and action handlers remain the original nodes |
| Backgammon, same landscape insets | Point targets were about 38px wide | Use 6 or 12 columns according to available width; page the existing points according to available height, keeping at least 44px targets |

The main document does not scroll. Boards and candidate lists use the existing
Previous/Next mechanism. Dismissing the keyboard restores the ordinary prompt,
labels and navigation. Full private prompts remain available through Game info.
No rules, server, protocol, scoring, host renderer or credentials changed.

## Same-state visual evidence

The paired captures use one local room per game and the same actor, authoritative
pack, prompt assignments, score state and draft. A local browser intercept serves
baseline #97 controller assets for Before, then reloads candidate assets for
After. It asserts that authoritative gameplay state did not change between
captures. Browser-only reload/connection revisions may change. Images are
synthetic browser geometry, not photographs of a physical OS keyboard or notch.

| Game | Before | After |
| --- | --- | --- |
| Prompt Duel | [Before](evidence/phone-device-readiness/paired/duel-before.png) | [After](evidence/phone-device-readiness/paired/duel-after.png) |
| Color Clash | [Before](evidence/phone-device-readiness/paired/colors-before.png) | [After](evidence/phone-device-readiness/paired/colors-after.png) |
| Backgammon | [Before](evidence/phone-device-readiness/paired/backgammon-before.png) | [After](evidence/phone-device-readiness/paired/backgammon-after.png) |

Supplemental 150% text examples: [Duel with keyboard](evidence/phone-device-readiness/paired/duel-large-text-keyboard.png),
[estimate with keyboard](evidence/phone-device-readiness/paired/estimate-large-text-keyboard.png),
[quiz](evidence/phone-device-readiness/paired/quiz-large-text.png).

## Verification on the candidate

- `npm run check`: passed.
- `npm test`: 111 application tests passed, 0 failed/skipped.
- `npm --prefix examples/party-engine test`: 253 guest-engine/network tests passed, 0 failed/skipped.
- `npm run build`: passed, with existing bundle-size warnings.
- `CHROMIUM_EXECUTABLE_PATH=... npm --prefix examples/party-engine run test:browser -- phone-controllers.spec.js --reporter=line`: 49 passed, 0 failed/skipped, 1.1 minutes.
- A supplemental axe scan found zero violations in 15 scoped checks: five controller types at two sizes, three dialogs and both writing/numeric forms with keyboard, insets and 150% text together. This does not certify manual screen-reader or real-device behavior.
- The original 31-mode/four-size matrix remains. Seven new cases cover combined safe-area/keyboard geometry for Duel and estimates at 100% and 150% text, notched card/board pages, enlarged-text quiz/estimate pages and a real Backgammon move after paging.
- The Backgammon test visits every point in its original order, confirms navigation sends no action, selects point 12, pages back, then sends a move to point 14 through the real socket. The server's fixture uses dice [1,2]; it confirms the expected point-count changes and exactly one play action. Existing manual-dice rules are preserved.
- Text tests assert a computed 24px root size, not merely setting a style. Initial inline-stylesheet test setup was rejected by the existing CSP; using the supported style-property setter fixed the harness without weakening CSP.
- CSS safe-area overrides use Chromium CDP. Those five new safe-area cases intentionally skip in Firefox/WebKit; the two enlarged-text cases run in all engines. All existing browser checks remain enabled.

Local environment: Node 24.22.1, Playwright 1.64.1, Chrome for Testing headless
shell 156.0.8078.47, Linux/software rendering. Fresh hosted CI is required on the
updated PR head; earlier #97 workflow results apply to its earlier commit.

## Tilt integration handoff

The candidate merges cleanly with #93 (`cdc9cce`) in a disposable checkout.
The unmodified tilt run passed three cases and failed its existing strict 44px
bounding-box check at 43.99999237060547px, matching the prior baseline finding.
The tilt implementation and its owned source/test files are unchanged in this PR.

A proposed test-only precision adjustment is evaluated only in that disposable
checkout: round the measured bounding box to 0.01px before comparing it to 44.
This does not change the CSS minimum or skip steering, permission, stale-data,
calibration, drift/item or touch-fallback assertions. All four tilt cases passed in 37.4 seconds with that test-only rounding in
the disposable checkout. This is not a claim that the original test passed
unchanged, and the rounding is not shipped in this PR. Agent 00 / the tilt owner can review the one-line proposal:

```diff
-expect(b.height).toBeGreaterThanOrEqual(44);
+expect(Math.round(b.height * 100) / 100).toBeGreaterThanOrEqual(44);
```

## Physical acceptance additions

Extend [the existing test card](PHONE_UX_READINESS.md) on an actual iPhone/Safari
and Android/Chrome review build:

1. With the keyboard open, rotate and pan browser bars; keep the draft and submit visible outside the notch/home indicator. Repeat with larger system/browser text. Dismiss the keyboard and confirm the prompt, label and pager return.
2. In Color Clash, inspect all hand groups in landscape, choose a legal card and confirm the wide Draw button sends one action.
3. In Backgammon, visit every point group, select a source and destination across groups, and rotate/reload while maintaining the same table. Compare the authoritative result, not just the button highlight.
4. Retain the separate physical motion permission/feel checks and eventual 10–20-phone workplace/Wi-Fi pilot.

No physical-device results are claimed here.

## Sources, transfer size and ownership

All additions are original controller code, tests and captures. No new external
assets, packages, accounts, services, build hooks or license reuse. The central
provenance manifest remains owned by Agent 09.

Compared with #97 `197420d`, JS grows 23,557 → 25,011 bytes (gzip 6,772 → 7,182),
and CSS 21,087 → 21,992 bytes (gzip 4,022 → 4,199): **587 additional compressed
bytes**, measured with Node zlib defaults. This is a file-size observation, not a
whole-game speed claim. Screenshots are documentation, not runtime asset imports.
Board sizing runs through the existing coalesced resize/focus scheduler; it does
not add a per-frame network or gameplay path.

Write scope: controller JS/CSS, its browser spec, this follow-up and documentation
captures. Existing adapter APIs are unchanged. No changes to the TV PR or reserved
tilt files. Rollback: revert only this follow-up commit, keeping the first phone
pass. No merge or deployment is performed.
