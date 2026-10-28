# Homeward Hustle: original card-and-pawn race

An original Sorry-inspired addition to the existing nickname-only party room.
No commercial board, card art, wording, question bank, binary, API or code is
copied. The implementation, geometry, UI and house rules are original.

## Reference evidence

Reviewed Hasbro's [00390 rule sheet](https://instructions.hasbro.com/api/download/00390_en-us_sorry-game.pdf)
and [card-count FAQ](https://hasbro-new.custhelp.com/app/answers/detail/a_id/92/).
They document card-driven movement, four pawns, capture/return, protected lanes,
exact home entry, slides, a divided seven and an eleven swap. Editions differ;
this game specifies one coherent variant rather than promising every edition.
Sources inform functionality only. No external source code or asset is reused.

## Complete match flow

1. The host chooses Homeward Hustle. Guests use nicknames and the existing QR/PIN.
   A room supports 2–20 players. The server balances them into boards of 2–4
   players, with no one-player board. A two-player board uses opposite colors.
2. Each player has four individually labeled pawns. One starts on the track and
   three at Start for a faster opening. Joining order determines board membership;
   the first player at each board is selected randomly by the server.
3. The original board has a 48-space clockwise track, four separate five-space
   safety lanes and a shared-capacity Home per color. Players cannot enter another
   color's safety lane. A forward move at their gate enters their own lane.
4. On their turn, a player draws one face-up card from the server-shuffled deck.
   A single 30-second clock covers drawing and choosing a move. Other players and
   the host see the drawn card, never the undealt order. Deck exhaustion reshuffles
   the discards. The deck has five 1s and four each of 2, 3, 4, 5, 7, 8, 10, 11,
   12 and Bump: 45 cards total.
5. The phone offers only server-validated choices. Ordinary numbered cards advance
   a pawn. A 1 or 2 can instead launch a pawn onto its entry square; launching
   consumes that movement. A 2 grants another card after resolution, even when no
   move was possible. A 4 goes backward. A 10 offers forward ten or backward one.
6. A 7 can advance one pawn seven or divide seven positive steps between two
   different pawns. Both legs must be legal in order, and all seven steps must be
   used. Neither leg can launch a pawn. The preview explains the full move before
   it is committed atomically.
7. An 11 can advance eleven or exchange one track pawn with an opponent's track
   pawn. Start, Home and safety lanes are excluded from exchanges. Only the pawn
   playing the card activates a slide after the swap. When no forward eleven is
   legal, the player may decline an otherwise legal swap.
8. A Bump card launches a pawn from Start onto an opponent's track pawn, returning
   that opponent to Start. It cannot target a safety-lane or Home pawn. There is
   no forward-four fallback for this card in this variant.
9. Ordinary moves may jump over pawns. Landing on an opponent returns it to Start;
   an ordinary landing on one's own pawn is illegal. Home can contain all four
   pawns. A pawn in Home cannot move again. Home entry needs the exact count.
10. Each quadrant has two three-step slide arrows. A pawn landing exactly on a
    different color's slide start sweeps to its end and returns every pawn in
    that slide path to Start, including its owner's other pawns. This also applies
    to a pawn occupying the slide start. Own-color slides do not activate.
    Slides trigger after the selected movement, not while merely passing over.
11. Backward movement stays on the track or exits one's own safety lane. It never
    enters a safety lane backward. A later forward move may use the home gate
    without requiring a full clockwise circuit, allowing backward/swap shortcuts.
12. If no move is available, the player explicitly ends that card's turn. The
    server rejects voluntary passes when a mandatory legal move exists. On a
    timeout it burns any undrawn card, skips the player and ignores extra-turn
    privileges. It never automatically chooses a pawn or claims a human move.
13. The first player with all four pawns Home wins their board and gets 100 game
    points. Other players get 20 per Home pawn and 5 per safety-lane pawn.
    Completed boards remain visible while the other boards finish.
14. A board stops after 15 minutes or 600 resolved cards. An unfinished board has
    no fabricated winner: only Home/safety progress points are banked. All-idle
    boards score zero. The host can end a match; unfinished boards then add no
    points. Awards are at most once and feed the existing room championship.
15. Once every board settles, the host reviews the results, finishes the match,
    and can return everyone to the same lobby. Reloads/reconnects retain the
    exact current card, pawn positions, deck, clocks, turn and payout guards.

## Architecture and invariants

- `open-pack/homeward-rules.js`: pure geometry, deck, legal move generation and
  atomic simulation. Split moves simulate both legs before changing live state.
- `open-pack/homeward.js`: room integration, independent board clocks, role checks,
  once-only scoring, public projections and checkpoint validation.
- `public/homeward-ui.js` and `homeward.css`: original SVG board, large phone pawn
  choices, a guided split/swap chooser, move previews, rule help and turn clocks.
- Clients send a chosen move ID, never positions, cards, score or winner claims.
  Per-board versions permit independent boards to act concurrently while rejecting
  stale moves at the same board. Match IDs and authenticated socket actors still
  guard every action. End-match remains a host-only action.
- Future deck order is excluded even from host views. Only the current actor
  receives their legal move list. Legal choices are cached by board version,
  rather than recomputed for each of twenty sockets.
- The existing scheduler wakes for the earliest board deadline. Moving at one
  board cannot extend another board's clock. No simulation/rendering loop or new
  backend service is introduced.
- Checkpoint validation checks supported versions, membership, four pawns each,
  position occupancy, card inventory, turn/stage consistency, deadlines and award
  flags. Invalid state fails recovery instead of silently resetting a game.

## Acceptance and performance checks

- Rules: every card, blocked launches, forward/backward boundaries, exact home,
  own-pawn blocking, captures, protected lanes, slide sweeps, swap restrictions,
  split order and atomic rejection, deck exhaustion and card conservation.
- Engine: complete matches, 2–20 balanced players, independent-table concurrency,
  wrong actor/table/match/version, malformed/forged payloads, replay, legal-pass
  restrictions, extra turns, disconnect/timeouts, partial-board completion,
  host abort, idle zero scoring and at-most-once awards.
- Recovery: JSON round trips during draw/choose, after a split/swap/capture and
  after awards; identical hidden deck and legal move lists; corrupted snapshots
  reject. Unchanged account/document authorization tests must still pass.
- Browser: QR/nickname joining, visible phone action, drawing a card, keyboard
  controls, ordinary/split/swap/Bump move previews, reload and result flow;
  320/390px layouts, desktop board, touch targets, no horizontal overflow and
  automated accessibility checks. Physical phones and manual screen readers
  remain separate verification.
- Network: 10 and 20 guest sockets, five boards, host/player reconnect, role-bound
  move lists, hidden deck checks and concurrent independent actions. Target a
  bounded 32 KiB player/host state frame and local ACK p95 below 100 ms without
  injected storage delay. These are local budgets, not public/Wi-Fi guarantees.

Record actual test outcomes and deployment status in the PR. A feature branch
does not update the live website by itself.

## Verified delivery results — October 28, 2026

- TypeScript checking, the production build, 110 application tests and 248 guest
  engine tests passed. The guest suite includes 24 new focused rule/engine/network
  tests and the existing 10/20-player pack fixtures extended to this game.
- The engine tests play 27 deterministic varied full matches, including deck
  reshuffles, and check legal termination, inventory and once-only scoring.
- All 23 Chromium journeys in `homeward.spec.js` and `open-pack.spec.js` passed:
  five Homeward journeys plus eighteen existing game-pack journeys. The phone
  case uses a 320px viewport and a maximum-length 24-character nickname, checks
  that Draw is on the first screen, operates pawn controls by keyboard and reloads.
- A separate local axe scan reported zero violations on the 320px draw screen,
  320px split preview and 1280px host board. All three had no horizontal overflow.
  In the long-name phone check the Draw button ended at 761px or less in the
  844px viewport. This does not establish manual screen-reader or device testing.
- One local twenty-WebSocket/five-board run acknowledged thirty concurrent-board
  actions with a largest frame of 10,034 bytes and ACK p95 of 12.87ms. A separate
  network test restarted the server with a checkpoint store and resumed the same
  hidden deck, active card and board version before accepting a legal move.
  These measurements do not establish public-network latency or server capacity.
- The change adds no dependency, database migration or hosting resource. It is
  submitted separately for review; Homeward Hustle is not deployed by this branch.
  Firefox/WebKit CI and physical-device checks must be reported separately.
