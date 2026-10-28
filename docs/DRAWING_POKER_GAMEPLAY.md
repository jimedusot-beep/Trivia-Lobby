# Drawing and poker gameplay improvements

The earlier drawing game had a basic release-to-send canvas and tools that reset
after every render. The poker label opened a manual shared card/dice surface;
turn order, betting rounds, hand ranking and winner selection were left to the
group. Passing those earlier tests did not establish a complete guided poker game.

## Doodle Dash

- Send bounded drawing segments while a pointer is held, with one outstanding
  acknowledged action at a time. A held/slow submission cannot create a second
  phantom gesture. Match/phase checks still reject late or wrong-artist actions.
- Keep pen color and width in tab storage. White acts as an eraser. Keyboard
  drawing remains available. Undo/Redo operates on a whole grouped gesture,
  including a gesture streamed in multiple parts; new ink clears Redo.
- Expand the original word pool from 30 to 90 common prompts, without reusing a
  chosen word during a match. Keep words private until reveal, explain the
  artist/guesser roles and scoring, and acknowledge a successful guess explicitly.
- Preserve gesture sequence, drawing, redo history and solved status through a
  checkpoint. Bound each segment to 64 points, canvas to 2,400 points/200 segments,
  and local preview to 1,024 points. Warn when the canvas is nearly full.

## Guided five-card draw

The `poker` preset now starts an original guided game for 2–6 active seats. A room
may still hold 20 guests; extra guests watch. Whist keeps four manual seats and
its existing actions. Already-active legacy manual poker checkpoints continue
using their existing manual UI rather than being silently converted mid-hand.

Each player starts with 200 play chips. Five hands rotate the dealer. Each hand
antes up to five chips, deals five private cards, runs a betting round, allows one
exchange of zero to three cards, runs a final betting round, and awards pots.
Bets increase by ten chips; a round permits an opening full increase plus three
full raises. Short all-ins do not reopen an earlier player's raise rights.
The house ante/raise/draw limits are shown in the game help.

The server enforces turns, check/call/bet/fold eligibility, hand rankings and
kickers (including ace-low straights), all-in eligibility, side pots, tie splits,
and unmatched refunds. Odd chips go clockwise after the dealer. Folded hands
stay private. The host advances or finishes after a settled hand rather than
choosing a winner. A timed-out betting turn checks if free, otherwise folds;
a timed-out draw stands pat. Turns allow 45 seconds. Five hands or one funded
seat ends the match; tied chip leaders each earn 100 game points exactly once.
Cancelling an unfinished hand returns its contributions before final scoring.

Private hands, deck, draw selections and checkpoint internals are excluded from
other players' live views. Recovery validates a guided poker checkpoint rather
than replacing missing cards or chips with a new game. No account/database schema,
private document authorization, dependency or deployment change is needed.

## Evidence and release checks

Local root check/build pass. All 110 application tests and 211 guest-engine tests
pass with no skips. Rule tests cover every hand category, ties, short raises,
side pots, replay and recovery; 125 varied 2–6-seat games conserve all chips and
terminate. Drawing tests cover ordering, grouped undo/redo, privacy, full canvas,
unique chosen words and checkpoint round-trip. Network coverage exercises 10/20
connected guests with bounded active poker seats and reconnects.

Five focused Chromium browser journeys passed: private drawing/keyboard recovery,
live streaming with persistent tools and whole-gesture Undo/Redo, slow-submission
handling, guided poker through payout/next hand, and the retained Whist table.
The full game-pack browser suite and hosted Chromium/Firefox/WebKit suites are
release checks; their final results are recorded in the pull request. Browser
viewports are not physical-phone or manual screen-reader certification. No merge
or deployment is implied by these implementation results.

Rules references (behavior only, no copied source, assets or UI):
[five-card draw](https://www.pokerstars.com/poker/games/draw/) and
[hand/pot rules](https://www.pokerstars.com/poker/games/rules/).
The implementation uses explicit family play-chip house limits above. All code
and wording added here is original; existing AGPL/component notices are retained.
