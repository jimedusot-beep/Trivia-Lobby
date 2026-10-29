# Phone controller ergonomics — Agent 03

Branch: `feature/gx2-phone-ux`. Baseline: `55414cd` (main, October 29, 2026).
Scope: shared controller adapter, its CSS and controller-specific tests. No host
renderer, race physics, scoring, protocol, server or account changes.

## Reproduced problems and fixes

| Trigger | Before | After |
| --- | --- | --- |
| Join on a tall phone, then rotate/shrink Color Clash | Six-card groups persisted; cards overlapped the header and Draw crossed the play-area boundary | Regroup the same action nodes for the current viewport; preserve candidate order, handlers and the current focused action |
| Virtual keyboard pans the visual viewport without resizing it | Controller stayed at top 0 while the visible viewport started at 130px | Listen to visual-viewport scroll as well as resize; release both listeners on disposal |
| Room update while reading Options | Dialog moved keyboard focus to Back to game and lost reading position | Give controller chrome stable focus IDs and preserve the active dialog's focus/scroll across remounts |
| Read prompt in 568×320 landscape | Prompt button was 32px high | Keep its touch target at 44px |
| Open a controller dialog | Full-width Back button squeezed the title into a vertical column, leaving no usable content area | Give Back its natural width and reserve space for the title and body |
| Open a reference dialog on a notched screen | Dialog could start inside the unsafe top/side region | Keep dialog bounds within browser safe-area insets, including landscape |
| Backgammon at 568×320 | Point targets were about 42px wide | Reduce inter-point gaps so targets reach 44px without removing board actions |
| Prompt Duel above a simulated 260px keyboard viewport | Lock response extended past the play area | Reduce writing-card padding and heading size while the keyboard is present; retain the labeled field and draft |

No actions are sent by rotation, regrouping, pagination or opening reference
material. Existing controls are moved rather than copied. Scores and private
information still come from the calling player's authorized projection.

## Visual evidence

Screenshots use a local headless browser and show each issue before its respective fix (some earlier, unrelated fixes may already be present). The keyboard screenshots simulate
visual viewport geometry; the empty lower portion is not a real OS keyboard.

| Case | Before | After |
| --- | --- | --- |
| Color Clash, tall join → 320×480 | [Before](evidence/phone-ux/cards-before.png) | [After](evidence/phone-ux/cards-after.png) |
| Landscape prompt target | [Before](evidence/phone-ux/prompt-before.png) | [After](evidence/phone-ux/prompt-after.png) |
| Options during host disconnect | [Before](evidence/phone-ux/options-before.png) | [After](evidence/phone-ux/options-after.png) |
| Dialog header | [Before](evidence/phone-ux/dialog-header-before.png) | [After](evidence/phone-ux/safe-area-landscape.png) |
| Safe-area dialog | [Before](evidence/phone-ux/safe-area-before.png) | [Portrait](evidence/phone-ux/safe-area-portrait.png) / [Landscape](evidence/phone-ux/safe-area-landscape.png) |
| Backgammon landscape | [Before](evidence/phone-ux/backgammon-before.png) | [After](evidence/phone-ux/backgammon-after.png) |
| Prompt Duel with keyboard geometry | [Before](evidence/phone-ux/duel-before.png) | [After](evidence/phone-ux/duel-keyboard.png) |

[Controller following the panned visual viewport](evidence/phone-ux/keyboard-panned.png).

## Reproduce automated checks

From the repository root:

```sh
npm run check
npm test
npm run build
cd examples/party-engine
npm test
npm run test:browser -- phone-controllers.spec.js
```

Set `PARTY_CROSS_BROWSER=1` and select `--project=firefox` or `--project=webkit`
after installing the matching Playwright browsers. For screenshots, set
`PHONE_UX_SCREENSHOT_DIR` to an absolute output directory. A custom local Chrome
can be selected with `CHROMIUM_EXECUTABLE_PATH`; CI uses pinned Playwright browsers.

The native-mode matrix starts at 390×844, then checks **every page** at 320×480,
390×844, 568×320 and 844×390. It checks actual action bounds, 44px ordinary touch
targets, no document scrolling, dialogs and absence of accidental network actions.
Dense board squares/column selectors keep their established exceptions and
accessible names. Separate cases cover twenty candidates, writing drafts,
reload, keyboard geometry, viewport panning, dialog focus/reading position during
a real socket disconnect, disposal and legal Homeward split/swap/Bump actions.
A Chromium-only CDP check overrides actual CSS safe-area environment values in portrait/landscape (intentionally skipped in Firefox/WebKit, whose automation protocols do not offer this override). These are representative state checks, not an exhaustive walk of every possible
game state or proof of real-device usability.

## Physical iOS/Android test card — not yet executed

Test a review build containing this branch, not the unchanged public release.
Use the existing TV/computer host and at least one iPhone (Safari) and one Android
phone (Chrome). Record model, OS/browser version, browser zoom/text size,
orientation, URL/build SHA and Wi-Fi for each result. A second browser on a laptop
is useful for a controlled host reconnect. Do not expose credentials in captures.

| Step | Actions | Required result |
| --- | --- | --- |
| Guest entry | Camera-scan host QR; enter a long nickname; join without signing in | Correct room/player; readable status; no mandatory installation |
| Browser bars/safe areas | Show/hide browser bars; use portrait and both landscape directions; inspect notch and home-indicator edges | Header, primary actions and menu stay visible and tappable; document does not scroll |
| Answer games | Quiz: answer once. Likely: navigate to last candidate group and vote. Closest: type estimate with keyboard open | Full targets; exactly one accepted action; no hidden submit button |
| Writing | Prompt Duel: draft both assignments, rotate while typing, switch groups, reload; Caption/Survey: type and submit with keyboard | Drafts retained where supported; focused field and submit remain above keyboard; normal chrome returns when keyboard closes |
| Color Clash | Start in tall portrait, rotate to short landscape and back; visit every hand group; play a legal card, then draw on a legal turn | All cards and actions reachable; no overlap, lost cards, wrong-card submission or accidental action |
| Drawing | Artist: choose word, draw, Undo/Redo, inspect Pen tools. Guesser: type with keyboard and submit | No page drag during drawing; private word only visible to authorized artist; fitted guess controls |
| Guided poker/Homeward | Inspect private hand; use legal exchange/bet. Homeward: inspect a split-seven preview and confirm a legal move | Valid action remains visible; no opponent-private data; navigation does not execute a move |
| Remaining native games | Launch each mode listed below; visit all pages available to this role; perform an ordinary legal action where possible | Usable primary controls; optional Game info/Scores/Options can scroll internally |
| Dialog/reconnect | Open Options, scroll and focus a control; reload host, restore connection; close with Back/Escape if available | Reading position/focus preserved across same-phase update; gameplay inputs released while modal is open |
| Continuous controls | Race, Turbo, Wave, Trails, Tap: hold controls, open Options, rotate, background tab, return and reload | No stuck steering/button; same player/session recovered; no duplicate scores |
| Accessibility | Browser text-size/zoom at a comfortable larger setting; VoiceOver/TalkBack read prompt, field labels and buttons; navigate dialog and return | Named controls and understandable order; zoom remains enabled; record any clipping rather than assuming a pass |
| Return/leave | Host returns to lobby, starts a different game; guest deliberately leaves using Options | Normal lobby/entry layout returns; no stale viewport styling or lingering controller |

Catalog at the baseline: quiz, duel, charades, majority, likely, closest, survey,
impostor, percentage, category, bingo, caption, timeline, bracket, turbo, wave,
homeward, trails, no-say, tap, race, feud, draw, colors, four, chess, checkers,
reversi, mancala, table, backgammon (**31 modes**).

### Tilt integration boundary

PR #93 (`cdc9cce`) is open and unmerged at the start of this pass. This branch
neither copies nor rewrites its tilt implementation. Once combined in a local
merge rehearsal, rerun `race-tilt.spec.js` and the shared controller matrix. The
physical race checks must then also cover explicit motion permission, denial,
Center, Touch fallback, portrait/both landscape directions, stale readings and
opening Options while steering. Keep raw sensor readings on-device. Permission
and feel on actual iPhone/Android hardware remain unverified until recorded.

## Sources, size and handoff

All changes are original controller presentation/test code. No external code,
art, fonts, audio, packages or licenses were added. Evidence images capture our
own local UI. No provenance manifest entry is needed for new third-party reuse.
No new network requests, intervals, server writes or render loop were introduced.
Viewport scroll uses the existing coalesced animation-frame layout scheduler;
regrouping occurs only when the compact/tall group size changes.

Integration ownership: `phone-controller.js`, `phone-controller.css`, and
`browser-specs/phone-controllers.spec.js`; documentation/evidence are isolated
here. Existing exports and adapter call arguments remain unchanged. Check for
concurrent edits in these files, especially tilt CSS. No extra merge dependency;
rehearse with #93 before integrating either ordering. Rollback is reverting this
focused commit. Leave this PR unmerged and undeployed pending release review.

Runtime transfer observation: controller JavaScript grew from 21,303 to 23,557 bytes (gzip 6,231 → 6,772), and controller CSS from 20,309 to 21,087 bytes (gzip 3,931 → 4,022), measured locally with Node zlib at its default level. Total compressed increase: 632 bytes; this is a file-size measurement, not a whole-game performance benchmark. Documentation screenshots are not loaded by the app.

## Verification record

- `npm run check`: passed.
- `npm test`: 111 application tests passed, 0 failed, 0 skipped.
- `cd examples/party-engine && npm test`: 253 guest-engine/network tests passed, 0 failed, 0 skipped.
- `npm run build`: final production build passed after all controller changes.
- Focused regression checks first failed for viewport panning, dialog focus and the 32px prompt. The expanded tall-first matrix exposed Color Clash rotation overflow; the writing/keyboard check exposed Prompt Duel overflow. The touch-target audit exposed Backgammon width; the safe-area check exposed modal bounds. These initial failures were fixed, not disabled.
- Final controller-specific Chromium run: 42 passed, 0 failed, 0 skipped in 52.3 seconds. Covers all 31 catalog modes at the four sizes above. Tilt merge rehearsal and hosted CI are pending and must be recorded separately.
- Physical-device tests: not performed. This work has not been merged or deployed.

Local environment: Linux container, Node v24.22.1, Playwright 1.64.1, Google Chrome for Testing headless shell 156.0.8078.47; software rendering. This is not physical phone, OS keyboard, Wi-Fi or TV-GPU evidence.
