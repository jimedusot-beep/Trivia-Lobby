# One-screen guest controllers

The TV presents the room. Each guest device presents the current task and its
controls. This change covers the native party catalog; separately hosted Open
Party Lab projects keep their own interfaces.

## Interaction contract

1. Join with a nickname using the existing invitation and reconnect credential.
2. Show the game, connection feedback and server timer in a compact header.
3. Keep the active task and actions in a viewport-sized play area. Use a private
   card hand, drawing pad, board, buzzer, answer tiles or directional buttons as
   appropriate. Do not show the full room roster beneath these controls.
4. Long candidate lists and card hands use explicit Previous/Next groups. Prompt
   Duel shows one response assignment at a time. Changing a group never submits
   an action or discards an input draft.
5. Game info opens the complete prompt, rules and secondary game state. Scores
   opens public standings. Options shows the room and a deliberate Leave action.
   These accessible dialogs can scroll for long reference material. Gameplay
   does not require scrolling the document.
6. Preserve labels, keyboard access, zoom, focus after broadcasts, touch release
   and authoritative server feedback. Never clone a private state from another
   player's view or submit an action merely because the viewport changed.
7. Resize for browser bars, rotation and the on-screen keyboard. Hide decorations
   before reducing controls. Primary buttons remain at least 44px; dense board
   squares use the available board area and retain accessible square names.

## Per-format layout

| Format | Main surface | Secondary material |
| --- | --- | --- |
| Quiz, Majority, Bracket, Percentage | Prompt and large answer tiles | Scoring rules, round counts |
| Likely, Impostor, caption voting | Small groups of candidates | Full clues, submitted captions |
| Estimates, Survey, Category, captions | One input and submit | Help and completed submissions |
| Prompt Duel | One assignment and lock button | Other assignment via Previous/Next |
| Charades, Forbidden Word | Private clue and role-specific actions | Instructions and turn history |
| Bingo, paired boards, Backgammon | Board and current-turn actions | Opponents, rules and ancillary actions |
| Drawing | Fitted drawing and guess field, or undo/redo | Pen tools, clear, guess history |
| Color Clash, manual card table | Grouped hand and legal actions | Table details and optional actions |
| Five-card draw | Five private cards and betting/exchange | Opponents, pots and rules |
| Grand Prix, Turbo, Wave, Light Trails, Tap | Live status and large controls | Track/standings on TV, options |
| Homeward Hustle | Current card and guided pawn action | Board and detailed rules |

## Architecture and verification

`public/phone-controller.js` adapts existing player renderers, preserving their
nodes, handlers, draft storage and server action contracts. It has no server or
authentication changes. `phone-controller.css` supplies the viewport shell and
format-specific sizing. Host screens retain their current layout.

Verify every native mode on short/tall portrait phones and landscape. Assert both
document dimensions and actual visible action bounds; hiding overflow alone is
not sufficient. Exercise pagination, keyboard, drafts, dialogs, broadcasts,
reconnect, rotation and return to lobby. Existing game browser flows must continue
to submit real actions. Record local/CI/device results separately in the PR.

## Verified results — October 28, 2026

- TypeScript, production build, 110 application tests and 222 guest-engine tests
  passed on the main-branch game catalog.
- 138 distinct Chromium journeys passed across the full suite and focused
  reruns. The first full run passed 135/137; the two Turbo/Wave assertions were
  updated to expect the track on the TV and in the optional phone information
  panel, then both complete driving journeys passed. The added keyboard case
  brings the final catalog to 138 journeys; this is not a claim of one clean
  138-test run saved locally.
- The final 33-controller-check run passed. It visits every group of controls in
  all thirty merged games at 320×480, 390×844, 568×320 and 844×390. It checks
  actual action bounds, the header/menu bounds, no document scrolling, dialogs,
  twenty-player voting, drafts, reload and a simulated 260px visual viewport.
- Existing game journeys exercised phone answers, private clues and hands,
  drawing, keyboard strokes, betting, card exchange, team buzzers and steals,
  scoring, returning to the lobby, real WebGL fallback, and twenty racing
  controllers. Steering assistance was also verified across a reload.
- Twenty main-screen axe scans (five formats at four sizes) and three optional
  dialogs reported zero violations after making reference panels keyboard
  focusable. This does not establish manual screen-reader conformance.
- A separate local merge rehearsal with Homeward Hustle PR #89 passed its initial
  controller in four sizes and actual split-seven, swap and Bump actions, with
  bounds checks on the complex controls. That game has since been integrated from main into this release.
- The release CI results are recorded in the PR. Physical iPhone/Android keyboards,
  zoom and changing browser bars on real devices remain separate verification. No hosting or account
  change is required, and this branch does not deploy the website.

PR #88 is a parallel standalone Grand Prix phone-layout change. Reconcile that
presentation with this shared controller during release review. This branch
preserves the current TV/game logic and retains the authoritative assistance
setting on reload.

## Release integration

Homeward Hustle #89 is now merged into main, bringing the native catalog to 31.
Its existing QR, keyboard, split, swap, Bump and result journeys use the shared
controller; optional board inspection opens Game info. The complex-move fixture
waits for the resized game surface before navigating controller pages, and passed
three consecutive Chromium runs after that synchronization change.

The first WebKit CI failure in #90 was the 20-player race reload test. The saved
host snapshot showed a correctly completed first heat with twenty results
(finish times 38.1–40.0 seconds). The test had assumed the heat was still playing.
It now observes fresh authoritative socket state after reload, checks the same
match/heat and twenty players, and requires the UI to show either the current
live grid or all twenty completed results. The initial 20-kart/3D checks remain.
This changes test synchronization and assertions; race duration and game rules
are unchanged. CI must pass again on the combined release before deployment.

The second WebKit run exposed a real short-landscape overflow: the split-seven
confirmation button extended three pixels below the play area. Reducing the
finish-panel gaps and preview padding keeps the 44px action intact. The existing
complex-move test reproduced the failure locally and remains the regression gate.
