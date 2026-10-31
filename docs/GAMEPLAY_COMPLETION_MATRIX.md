# Gameplay completion audit — 31-game baseline

Audit baseline: PR #119 updated with main at 9811221 (Sorry Ish). This file is a **test-plan and evidence ledger**, not a certification that 31 complete matches have been watched. Every mode has an existing rule implementation and at least some catalog/engine coverage. The new standardized end-to-end completion test currently covers **Four in a Row**; every other entry below still requires an explicit full lifecycle proof before this particular gate is marked passed.

## Uniform acceptance gate

For each game, capture: room created and minimum seats connected; private player inputs accepted only for their actor; a real scoring/state update; all required rounds and terminal win/draw/final state; no duplicate point awards; host transitions to finished and Return to same party; guest/reconnect usability. Record the exact test name, browser, commit, and CI run. A host-initiated early stop is **not** equivalent to natural completion. Where a human judge or manual rule is intentionally required, verify the host action and label the limitation.

## Completion queue

| Group | Game (mode ID) | Completion status in this standardized suite | Highest-priority check |
| --- | --- | --- | --- |
| Social | Trivia Quiz (quiz) | Pending | Five questions, total score, return |
| Social | Prompt Duel (duel) | Pending | Writing/vote sequence, authorship privacy, final |
| Social | Charades (charades) | Pending | Each actor turn, correct/pass, final |
| Social | Majority Rules (majority) | Pending | Five rounds, tie scoring |
| Social | Who's Most Likely? (likely) | Pending | Nominations, tie outcome, final |
| Social | Closest Wins (closest) | Pending | Guess bounds, close/tied winner, final |
| Social | Survey Showdown (survey) | Pending | Matching, five boards, result |
| Social | Secret Impostor (impostor) | Pending | Clue/vote privacy and all reveals |
| Social | Guess the Percentage (percentage) | Pending | Two-stage input, computed scores, final |
| Social | Category Clash (category) | Pending | Unique/duplicate answers, acceptance |
| Social | Family Bingo (bingo) | Pending | Real line win and repeat marking |
| Social | Caption Chaos (caption) | Pending | Submission/voting/final score |
| Social | Timeline Tangle (timeline) | Pending | Four-event ordering, final |
| Social | Bracket Battle (bracket) | Pending | All fifteen matchups, tournament winner |
| Arcade | Party Grand Prix (race) | Pending | All heats, placing and return |
| Arcade | Turbo Circuit (turbo) | Pending | Drive/boost/obstacle finish |
| Arcade | Wave Sprint (wave) | Pending | Lane/boost/finish across two racers |
| Arcade | Light Trails Royale (trails) | Pending | Elimination, full heats and return |
| Arcade | Tap Dash (tap) | Pending | Three heats, ties and scoring |
| Creative | Family Showdown (feud) | Pending | Buzz, strikes/steal, lightning, final; host adjudication |
| Creative | Doodle Dash (draw) | Pending | Live strokes, guesses, all artist turns |
| Creative | Forbidden Word Frenzy (no-say) | Pending | Referee, clue rotation, final |
| Board | Sorry Ish (homeward) | Pending | Four pawns Home, card/slide/swap logic, full board settlement |
| Board | Color Clash (colors) | Pending | Hand exhausted, bots/cards/timer, settlement |
| Board | Four in a Row (four) | Browser lifecycle test added; CI verification required | Seven real alternate moves, winner score, Next, return |
| Board | Chess Club (chess) | Pending | Checkmate or draw and return; no forced early stop |
| Board | Checkers Chase (checkers) | Pending | Captures, promotion, winner |
| Board | Reversi Rivals (reversi) | Pending | Final disc majority, auto pass |
| Board | Mancala Match (mancala) | Pending | Stone conservation, end stores, score |
| Tabletop | Card & Dice Table (table) | Pending | Guided Poker full five hands; Whist intentionally manual |
| Tabletop | Backgammon Table (backgammon) | Pending | Manual dice flow, bearing off and finish |

## Existing evidence is not discarded

The repository already tests specific game mechanics through engine, network and browser suites, including complete deterministic engine games for boards, cards, poker and Sorry Ish. Those tests remain required. This ledger adds a stricter **single-tab, actual-host-and-controller full-match** bar without reclassifying earlier engine evidence as a 31/31 browser pass.

## Next additions

Extend the browser completion suite incrementally, grouping quick automated games first, followed by creative multi-phase and manual tabletop games. Use the real server, ordinary inputs and bounded test timers; never fake final state or credit an early-stopped game as a natural finish. Run the new test in all three browser engines before considering an individual mode passed. Whist's host-awarded manual results and Backgammon's manually managed dice must be reported explicitly, not silently represented as rules-automated.
