# Gameplay completion audit — 31-game baseline

Audit baseline: PR #119 updated with main at 9811221 (Sorry Ish). This file is a **test-plan and evidence ledger**, not a certification that 31 complete matches have been watched. Every mode has an existing rule implementation and at least some catalog/engine coverage. The standardized real-server host/controller full-match browser tests now cover **Four in a Row** and **five-round Trivia Quiz**, both included in merged PR #119 and successful on its head at [run 41313021016](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/41313021016). PR #130 subsequently added three more full-match tests: Majority Rules, Who's Most Likely?, and Closest Wins, and its Chromium, Firefox and WebKit guest suites passed on head `2335fdff2b59279805e24751e010883b975fa04c` ([guest-browser run 41516411410](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/41516411410)). PR #141 added a verified five-round Survey Showdown single-tab completion with English/Spanish alias parity, score and same-party return: its Chromium, Firefox and WebKit guest jobs passed on head `84d8454a22dca91aeb37c81dab2fef8d68a82aaa` ([guest-browser run 41892750051](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/41892750051)). PR #143 added a real-server five-round Category Clash test for bilingual duplicate scoring, natural finish and same-party return; its Chromium, Firefox and WebKit guest jobs passed on head `be6e31b2fe5ae352d69f10ec396d6185a57571d7` ([guest-browser run 41947727455](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/41947727455)). PR #156 added Guess the Percentage's five-round, three-controller Solo Test playthrough, including numeric vote/guess actions, private pre-reveal projections, fixed final scores, a submitted guest's online-lifecycle socket reconnect, and return to the same party. Its Chromium, Firefox and WebKit guest jobs passed on head `5b36254fbc0d63c41920369f61535d7915e54596` ([guest-browser run 44436240508](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/44436240508)); the owner merged it as `51087647d0627521e57239c6a1612d3767c5833e`. Together, **8/31 modes have demonstrated full-match browser coverage on their verified PR heads; 23 remain**. This does not certify all 31 games on current `main`, a live deployment, or physical devices; the exact current-main evidence for Percentage is recorded below. Engine/unit coverage remains wider. These headless results are not evidence of physical-device acceptance.

## Uniform acceptance gate

For each game, capture: room created and minimum seats connected; private player inputs accepted only for their actor; a real scoring/state update; all required rounds and terminal win/draw/final state; no duplicate point awards; host transitions to finished and Return to same party; guest/reconnect usability. Record the exact test name, browser, commit, and CI run. A host-initiated early stop is **not** equivalent to natural completion. Where a human judge or manual rule is intentionally required, verify the host action and label the limitation.

## Completion queue

| Group | Game (mode ID) | Completion status in this standardized suite | Highest-priority check |
| --- | --- | --- | --- |
| Social | Trivia Quiz (quiz) | Browser full-match test passed on merged PR #119 head | Five questions, scoring, natural finish, return to original room; repeat on post-merge main |
| Social | Prompt Duel (duel) | Pending | Writing/vote sequence, authorship privacy, final |
| Social | Charades (charades) | Pending | Each actor turn, correct/pass, final |
| Social | Majority Rules (majority) | Browser full-match passed on merged PR #130 head | Five rounds, 3 real votes, scored majority, same-room return; tie-case coverage remains |
| Social | Who's Most Likely? (likely) | Browser full-match passed on merged PR #130 head | Five rounds, valid non-self nominations, final scores, same-room return; tie-case coverage remains |
| Social | Closest Wins (closest) | Browser full-match passed on merged PR #130 head | Five private guesses, server-scored closest answer, final, same-room return; tied-winner coverage remains |
| Social | Survey Showdown (survey) | Browser full-match passed on merged PR #141 head | Five server-scored EN/ES answers, privacy, result, same-party return; physical-device proof remains |
| Social | Secret Impostor (impostor) | Pending | Clue/vote privacy and all reveals |
| Social | Guess the Percentage (percentage) | Browser full-match test passed on merged PR #156 head | Five private vote/guess rounds, exact scores, submitted-guest socket reconnect and same-party return; physical-device proof remains |
| Social | Category Clash (category) | Browser full-match test passed on merged PR #143 head | Five EN/ES duplicate-scored rounds, unique answers, final scores, same-party return; repeat on post-merge main |
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
| Board | Four in a Row (four) | Browser full-match test passed on merged PR #119 head | Seven real alternate moves, winner score, Next, return; repeat on post-merge main |
| Board | Chess Club (chess) | Pending | Checkmate or draw and return; no forced early stop |
| Board | Checkers Chase (checkers) | Pending | Captures, promotion, winner |
| Board | Reversi Rivals (reversi) | Pending | Final disc majority, auto pass |
| Board | Mancala Match (mancala) | Pending | Stone conservation, end stores, score |
| Tabletop | Card & Dice Table (table) | Pending | Guided Poker full five hands; Whist intentionally manual |
| Tabletop | Backgammon Table (backgammon) | Pending | Manual dice flow, bearing off and finish |

## Certification evidence and remaining gap

- **Verified on merged PR heads: 8/31.** Four in a Row and Trivia Quiz: PR #119; Majority Rules, Who's Most Likely?, and Closest Wins: [PR #130](https://github.com/jimedusot-beep/Trivia-Lobby/pull/130), head `2335fdff2b59279805e24751e010883b975fa04c`, [guest-browser run 41516411410](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/41516411410) (Chromium/Firefox/WebKit successful).
- **Survey Showdown:** [PR #141](https://github.com/jimedusot-beep/Trivia-Lobby/pull/141), head `84d8454a22dca91aeb37c81dab2fef8d68a82aaa`, [guest-browser run 41892750051](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/41892750051) (all three passed); five ordinary rounds with answer privacy and same-party return.
- **Category Clash:** [PR #143](https://github.com/jimedusot-beep/Trivia-Lobby/pull/143), head `be6e31b2fe5ae352d69f10ec396d6185a57571d7`, [guest-browser run 41947727455](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/41947727455) (Chromium/Firefox/WebKit successful); five ordinary bilingual rounds, duplicate-versus-unique scoring, natural finish and return to the same party.
- **Guess the Percentage:** [PR #156](https://github.com/jimedusot-beep/Trivia-Lobby/pull/156), tested head `5b36254fbc0d63c41920369f61535d7915e54596`, owner merge `51087647d0627521e57239c6a1612d3767c5833e`, [guest-browser run 44436240508](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/44436240508). Test: `examples/party-engine/browser-specs/solo-percentage-completion.spec.js` — `completion: Guess the Percentage finishes five private scored rounds, reconnects a locked guest, and returns to the same party`. It covers five ordinary three-player vote/guess rounds, numeric 1/0 and 0–100 actions, 33/67 rounding and 0/100 boundaries, pre-reveal result privacy, exact final scores 500/400/0, and return to the original party retaining scores. Reconnect uses the application's online lifecycle to reopen a real socket for the same submitted guest; it is not a physical network-loss or page-reload test. Keyboard activation does not establish phone touch acceptance.
- **Percentage CI qualifications:** the full unfiltered PR guest suites included the new spec. Chromium reported 229 clean passes plus a retry-passed Homeward controller case; Firefox and WebKit each reported 221 passed and 9 existing browser-specific skips, with no flaky case. The separate bilingual Firefox workflow also retried a Survey Showdown case. Neither reported flaky case is the new Percentage spec; retain those reliability follow-ups. This spec adds no mock state, early finish, application clock acceleration, skip or retry condition. Separate focused local evidence reproduces a Survey Showdown host Next/pointer interruption defect when a guest disconnects during a pointer hold; it remains unrepaired and is not credited as passing recovery acceptance.
- **Current-main checkpoint for Percentage:** actual owner merge `51087647d0627521e57239c6a1612d3767c5833e` has the same Git tree as the reviewed head. Its own [core CI run 44440650853](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/44440650853), [integrated acceptance run 44440650924](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/44440650924) and [full guest run 44440650831](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/44440650831) passed. Integrated browser jobs each report 37 passed. Full guest results: Chromium 230 passed; Firefox 221 passed / 9 skipped; WebKit 221 passed / 9 skipped; each guest Node suite passed 340 tests. No failed or flaky case was reported in these post-merge browser summaries. These are actual-main executions, separate from the qualified PR-head results; they do not close the separately reproduced pointer-interruption defect or physical-device release gates.
- **Remaining: 23/31** require full-match evidence in this suite. Smoke checks and standalone engine tests do not add to this count.
- **Separate gates:** repeat/reconcile on current `main`, physical phone + TV/Wi-Fi acceptance, and backup/release approval before production deployment.

## Existing evidence is not discarded

The repository already tests specific game mechanics through engine, network and browser suites, including complete deterministic engine games for boards, cards, poker and Sorry Ish. Those tests remain required. This ledger adds a stricter **single-tab, actual-host-and-controller full-match** bar without reclassifying earlier engine evidence as a 31/31 browser pass.

## Next additions

Extend the browser completion suite incrementally, grouping quick automated games first, followed by creative multi-phase and manual tabletop games. Use the real server, ordinary inputs and bounded test timers; never fake final state or credit an early-stopped game as a natural finish. Run the new test in all three browser engines before considering an individual mode passed. Whist's host-awarded manual results and Backgammon's manually managed dice must be reported explicitly, not silently represented as rules-automated.
