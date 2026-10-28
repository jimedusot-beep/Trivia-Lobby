# Open game pack: implementation and acceptance

## Player outcome

One account-free Pick a Game menu opens a hosted game with a room code and a local QR invitation. Guests use a nickname. Existing issued reconnect credentials remain authoritative; private study APIs and storage are unchanged.

The six upstream applications are architectural sources, not interchangeable packages. This delivery adapts their useful game formats into the existing guest runtime instead of introducing six independent web servers, new infrastructure, upstream host passwords, or upstream branding. It must not be described as six complete application forks.

## Scope

- Friendly Feud: original team showdown with first-arrival phone buzzers, hidden answer board, host judging, three strikes, steal, round multipliers and a two-player timed lightning final. Original sample questions; no claim that curated points are real survey results. Host can import a bounded custom show.
- Scribble.rs: original drawing/guessing game with a private clue, a shared bounded stroke canvas, scoring, alternating artists, timer, undo/clear, and recovery of the current drawing.
- Unoverse: licensed adaptations of deck generation, turn math and scoring, with original two-dimensional presentation, private hands, legal plays, skip/reverse/draw/wild actions, configurable draw stacking, bots, and timed turns. Up to ten seats; additional guests watch.
- FreeBoardGames.org: selected rule adaptations for Four in a Row, Mancala and Checkers, independently implemented standard two-player Reversi, and a pinned chess.js dependency for chess. Parallel paired tables let 10–20 guests play in one room; an odd seat gets a bot.
- Card & Dice Table now offers [original guided five-card draw](DRAWING_POKER_GAMEPLAY.md) with enforced turns, card exchange, ranking and automatic pots. The VirtualTabletop-inspired manual surface remains for Whist and already-active legacy manual poker rooms. Backgammon still uses manual dice rules. This is a compact adaptation, not the upstream game shelf or routine editor.
- Razzia: import supported single-answer quiz JSON into the existing local quiz editor; preserve explanations. Preserve single-answer timers, point values and wrong-answer penalties; reject incompatible multi-answer, estimation, survey, media and scoring-option files explicitly rather than silently changing their meaning. Razzia cooldown delays and category grouping are not imported; Trivia Lobby reveals when answers close. Existing Trivia Quiz remains the hosted trivia mode.

## Contracts and failure cases

Every new action is schema-bounded, actor-bound and checked against the current match/revision. Hidden cards, clue words, undealt cards and unrevealed board answers are excluded from other players' views. Only the host can judge, deal, change settings or finish a manual table. Players cannot move another pair's board, play another hand, impersonate a reconnect, or claim a score. Live drawing is bounded by per-message point count, total stroke count and transport rate limits. A disconnected turn holder times out safely.

Acceptance: existing engine tests; full new matches and game-specific edge cases; malformed/unauthorized actions; hidden-state checks; 10/20 socket clients with host/player reconnects; QR-decoded browser joining; phone layouts and keyboard actions; TypeScript and production build. Report exact outcomes and limitations.

## Source provenance and delivery

Record exact upstream revisions and reuse scope in `docs/OPEN_GAME_SOURCES.json` and preserve copied-code notices in the new pack. Code adapted from AGPL sources stays under AGPL with corresponding source offered from the UI. New artwork and content are original. No upstream assets, names of commercial shows, or question banks are copied.

Merge, deployment and production verification are separate from implementation. No new paid service or database is required.
