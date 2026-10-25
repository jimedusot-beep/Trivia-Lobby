# Forehead guessing and acting party games

Research snapshot: **2026-10-25**. Trivia Lobby baseline: [`0341181653`](https://github.com/jimedusot-beep/Trivia-Lobby/tree/0341181653c00f0015b71339517bbc71d6530c2a).

Evidence labels: **DOC** = retrieved publisher documentation; **SRC** = inspected pinned source, not executed; **TEST** = command actually run; **DESIGN** = original proposed behavior, not a competitor claim. A file existing is not proof its feature works. None of the competitor applications were run, and no proprietary implementation was inspected. See [comparison and validation](REA_FEATURE_COMPARISON.md) for shared limits and [assignments](REA_IMPLEMENTATION_ASSIGNMENTS.md) for delivery contracts.

## Sources and identity checks

**DOC P1:** [Heads Up! by Warner Bros., App Store ID 623592465](https://apps.apple.com/us/app/heads-up/id623592465) describes selecting a deck, holding the phone to the forehead, tilting down for correct and up to pass. Publisher copy also mentions optional recording. No app was installed, sensor-tested or recorded here.

“Charades” is a game family, not one identified vendor/version in the brief. This specification covers an original acting/guessing variant; it does not assert one authoritative commercial Charades app behavior. Repository evidence below includes a Heads Up-inspired charades app, an incomplete Android recreation, and a **drawing** game as a related role/projection reference. `vintage/party_flutter` is relevant to both Heads Up and Charades and is counted once as a repository. `sgepigon/heads-up` + `vintage/party_flutter` supply two Heads Up leads; `vintage/party_flutter` + `kroist/Charades` supply two Charades-family leads. The drawing reference is not misrepresented as acting-game parity.

Rejected lead: [skofman/huh](https://github.com/skofman/huh), inspected snapshot `692972a987a205a184a0e8d0f3f142776ae21b8e`: README identifies Heads Up Hold'em poker, so it contributes no guessing-game requirements.

## Original state machine and rules (DESIGN)

Setup → handoff → 3-second ready countdown → active 60-second round → round summary → next team → match summary. Options include 30/60/90 seconds and untimed practice. Minimum 2 nicknames for pass-and-play; no emails. Default match gives each team two equal turns. Tie is shown as a tie; an optional extra full cycle must be offered equally.

- **Forehead mode:** device displays the clue to helpers; guesser does not inspect it. Correct +1; pass 0; each action consumes one clue. No replacement within a round. Exhaustion ends round with an explicit message. Do not recycle passed clues immediately.
- **Acting mode:** actor privately previews one clue behind a handoff screen, acknowledges Ready, then performs without spoken clues. A designated local referee marks Correct/Pass; this is self-reported party scoring, not automatic recognition. No camera or microphone needed.
- Pause freezes remaining time only in local pass-and-play; all controls except Resume/Exit disabled. Backgrounding local play auto-pauses and shows an overlay before revealing the next clue. Online rounds, if later added, use server deadlines and explicit host pause policy instead.
- At expiry, freeze scoring immediately, then summarize correct/passed clues and team totals. Events at the boundary use the reducer's monotonic time, not animation completion. Undo last local mark is allowed before the next action or expiry and restores that clue/score; it does not extend time.

## Proposed architecture

Add `shared/party-round.ts` pure reducer with injectable monotonic clock and seeded shuffle for tests. State contains sessionId, roundId, revision, phase, mode, teamOrder, turnIndex, queue, currentClueId, processedActionIds, marks and remaining time. Use an original curated clue pack with attribution and age/topic labels; do not copy commercial decks. Reuse canonical deck content only through explicit public demo manifests or authenticated owner selection. Acting/forehead prompts are not ordinary multiple-choice questions and should have their own validated content adapter.

Add a public `/party` route and local UI; keep online multiplayer out of the first reducer/UI slices. Existing `party` quiz mode in `server/game-modes.ts` doubles points every third quiz round; preserve its behavior and label the new activities distinctly. A later online protocol needs clue projection by role (actor/helper/guesser/referee), credentialed referee action authority, room revisions and replay protection. Never broadcast an actor's secret clue to the guessing client and merely hide it with CSS.

Optional motion adapter maps tilt to the same Correct/Pass actions as buttons. Request motion permission from a user gesture only; default to touch/keyboard if denied/unavailable. Proposed calibration: neutral band ±15°, trigger >45° for 250 ms, one action until return to neutral for 300 ms; debounce duplicate events and ignore hidden pages. Thresholds are initial tuning parameters, **not measured device compatibility**. Recording is excluded from this release.

## Specific tests and performance requirements (DESIGN, unrun)

1. Fixed-seed 3-clue round consumes correct/pass/correct with score 2; no repeated clue; exhausted queue ends once. Empty/invalid pack cannot start.
2. Fake clock: pause at 20 s, resume after 5 min preserves 40 s. Expiry and Correct in same tick award at most once using deadline order; reload restores handoff, never exposes a secret clue on load.
3. Two teams × two turns rotates fairly; double tap and replayed action ID change score once. Undo restores clue and total; disabled after expiry.
4. Permission denied, portrait/landscape changes and no sensor all preserve fully operable buttons. Synthetic jitter/held tilt emits once until rearmed. Physical iOS/Android tests remain required; emulation alone is insufficient.
5. Keyboard Correct/Pass/Pause; 44 px controls, high-contrast text and 200% zoom; do not announce hidden clues to a screen reader on a guesser surface. Offer a seated, touch-only variant and untimed practice. Announce start, 10 seconds remaining and end rather than every tick.
6. Reducer p95 <5 ms for 500 clues on recorded hardware; visible feedback within 100 ms; timer display corrected within 250 ms after foreground resume. No score writes while hidden or paused. Budget is proposed, not measured.

## Baseline and limitations

Search of pages, shared protocol and game modes found no acting/forehead runner or DeviceOrientation adapter. That is a source-level missing assessment, not proof no such feature exists on an unmerged branch. G5/G6 own the two local slices; G8 is optional motion enhancement after button play passes. No production sensor, sound, native app or multiplayer party behavior verified.

## Pinned repository evidence

All listed projects are independently maintained references/alternatives; they are not official competitor source. Metadata and selected files were checked on the research date. “Not archived” is a GitHub flag, not a maintenance or quality guarantee.

### [sgepigon/heads-up](https://github.com/sgepigon/heads-up)

- Snapshot: `6807b1b00ef822b5b1a7ef5fb751c0b15cd009c9`; not archived; last push reported `2017-10-29T04:06:52Z`; fork flag `False`.
- License: **none detected**. Root license files inspected: none found. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`app/src/main/java/leo_santi/heads_up/MainActivity.java`](https://github.com/sgepigon/heads-up/blob/6807b1b00ef822b5b1a7ef5fb751c0b15cd009c9/app/src/main/java/leo_santi/heads_up/MainActivity.java). Android activity has a five-second timer, two player scores, correct/pass handlers and turn switching.
- Useful pattern and limitation: Incomplete prototype: setDefaultGame replaces a populated queue with an empty queue. Skip queues the current word; do not copy these semantics or assume it is playable.

### [vintage/party_flutter](https://github.com/vintage/party_flutter)

- Snapshot: `f1ce41376cb11d21be1151491bb314e9faa6573a`; not archived; last push reported `2019-10-25T12:40:58Z`; fork flag `False`.
- License: **Apache-2.0**. Root license files inspected: `LICENSE`. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`lib/ui/screens/game_play.dart`](https://github.com/vintage/party_flutter/blob/f1ce41376cb11d21be1151491bb314e9faa6573a/lib/ui/screens/game_play.dart). Configurable round time, question category, rotation control, pause flag, answer animation and camera setting.
- Useful pattern and limitation: Flutter app explicitly inspired by Heads Up. Companion game_controller.dart offers tap controls. Old Flutter APIs; recording/ads/analytics are not requirements for our version.

### [kroist/Charades](https://github.com/kroist/Charades)

- Snapshot: `c255490462418e18ed488d7fc2933e7e3b990049`; not archived; last push reported `2026-10-19T21:45:04Z`; fork flag `False`.
- License: **MIT**. Root license files inspected: `LICENSE`. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`server/src/main/java/com/charades/server/Game.java`](https://github.com/kroist/Charades/blob/c255490462418e18ed488d7fc2933e7e3b990049/server/src/main/java/com/charades/server/Game.java). Only the drawer receives GameWord; timer broadcasts remaining time; correct guess or drawer departure ends the game.
- Useful pattern and limitation: Java/JavaFX drawing-and-guessing, adjacent to acting charades, not a physical acting clone. Role-specific projection is useful; deserialization/network security was not audited.
