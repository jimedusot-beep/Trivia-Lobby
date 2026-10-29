# Phone navigation continuity

Follow-up to merged phone PR #97, based on main `4f7c321` (which also includes
the TV, race visual and tilt changes). This branch changes only the phone
presentation adapter, its browser spec and this handoff. No new dependencies,
assets, protocols, game rules or TV/tilt implementation changes.

## Problems reproduced

- In a twenty-player Who's Most Likely game, focus the last visible candidate
  at 844×390, then rotate to 320×480. The original code hides that candidate
  because page capacity changes without changing the choice-group size.
- Open the full question from the prompt button, receive a room update, then
  press Escape. The original code sends focus to Game info rather than back
  to the prompt that opened it.

Both new regression tests failed against the unchanged main adapter before the
fix. A further round-trip rotation check caught an intermediate implementation
that shifted its reference to the first item on each newly computed page.

## Behavior

Layout retains the same task node across page recalculations and repeated
rotations. Explicit Previous/Next navigation selects a new reference. Focusing
the menu does not discard it. Existing button nodes and action closures are
preserved; resizing and browsing never submit a nomination.

Game-help dialogs remember the actual activation target, including pointer
activation in browsers that do not focus clicked buttons. Prompt, round-details
and Pen tools buttons have stable identities across authoritative remounts.
Closing help returns to that visible, enabled opener, with the appropriate menu
button retained as a fallback. Existing modal keyboard isolation remains.

Four added cross-browser cases cover:

1. Focused candidate continuity after rotation, followed by a real socket
   submission using Enter: exactly one accepted nomination.
2. Full-prompt focus return after a host-disconnection broadcast/remount.
3. Candidate-group continuity through portrait and back to landscape while
   focus stays on the menu, with no game action.
4. Pen tools focus return through both Back and Escape, preserving selected
   blue ink and bold width, with no extra play action after word selection.

These cases add no browser-specific skips. Existing CDP/GPU skips are unchanged.

## Verification

Local environment: Node 24.22.1, Playwright 1.64.1, Chrome for Testing headless
shell 156.0.8078.47 on Linux/software rendering.

- `npm run check`: passed.
- `npm test`: 111 passed, zero failed/skipped.
- `npm --prefix examples/party-engine test`: 259 passed, zero failed/skipped.
- `npm run build`: passed, with existing bundle-size warnings.
- Four new focused browser cases: passed. Full controller and supplemental
  drawing/tilt results, plus hosted CI status, are recorded in the pull request.

Run the full phone suite with:

```sh
CHROMIUM_EXECUTABLE_PATH=/path/to/chrome-headless-shell \
  npm --prefix examples/party-engine run test:browser -- \
  phone-controllers.spec.js --reporter=line
```

The adapter grows from 25,011 to 26,017 bytes, or 7,182 to 7,503 bytes gzipped
with Node zlib defaults: 321 additional compressed bytes. No new network calls
or per-frame gameplay work. No physical phone or screen-reader results are
claimed. Repeat the same rotation/help checks on iPhone/Safari and
Android/Chrome, including external keyboard or switch navigation where used.
No merge or deployment is performed by this follow-up.
