# Educational game formats and strategic rewards

Research snapshot: **2026-10-25**. Trivia Lobby baseline: [`0341181653`](https://github.com/jimedusot-beep/Trivia-Lobby/tree/0341181653c00f0015b71339517bbc71d6530c2a).

Evidence labels: **DOC** = retrieved publisher documentation; **SRC** = inspected pinned source, not executed; **TEST** = command actually run; **DESIGN** = original proposed behavior, not a competitor claim. A file existing is not proof its feature works. None of the competitor applications were run, and no proprietary implementation was inspected. See [comparison and validation](REA_FEATURE_COMPARISON.md) for shared limits and [assignments](REA_IMPLEMENTATION_ASSIGNMENTS.md) for delivery contracts.

## Sources and evidence

**DOC E1:** [Blooket game mode previews](https://help.blooket.com/hc/en-us/articles/31616660563479-Blooket-Game-Mode-Previews) documents multiple modes with live, solo and homework availability. This is not evidence every mode supports every context. **DOC E2:** [Gimkit cosmetics explained](https://help.gimkit.com/en/article/cosmetics-explained-10ht2ek/) documents Rewards/Locker/Shop and account cosmetics. Do not conflate account cosmetics with round balances. Exact Gimkit Classic upgrade prices, score formulas and production transaction logic were not verified; a guessed Classic help URL did not resolve and is excluded as evidence.

Two independent references per platform are pinned below. Blooket search results were sparse after excluding cheats/bots, and one candidate is explicitly only a UI shell. These are relevant recreations, not two proven complete alternatives. Source review of Gimkit-Clone exposed client-forwarded balance/upgrade events; those are security counterexamples, not reusable server-authority patterns.

## Original modes and navigation (DESIGN)

Public demo → select format with a plain-language rules preview → configure teams/time → play → see factual accuracy separately from game points → rematch using the same question snapshot. Launch only modes already supported by a tested adapter; unsupported answer types get an explicit message before hosting. Avoid reimplementing all Blooket formats before the guest slice ships.

The current server supports classic, teams, buzzer, wager, workshop and party. `scoreRound` already separates coins from score and study mastery; workshop awards 20 coins on a correct answer, focus costs 60 and guard costs 40. These are existing Trivia Lobby constants, not Gimkit values. Extend the existing workshop rather than replacing it with a new economy.

| Action | Original intended invariant | Feedback/error |
| --- | --- | --- |
| Correct answer | Server computes score and round currency once | Explain earned score/coins separately |
| Buy focus/guard | Atomic check and debit; bounded inventory; request ID deduplication | Display cost, balance and effect before purchase; insufficient coins leaves state unchanged |
| Wager | Integer 0..min(score,100); no debt | Invalid wager rejected without consuming answer |
| Mode switch | Choose before start; immutable within match | Reject mid-question mode mutation |
| Match end | Currency resets per match; factual report preserved under existing policy | Explain that virtual rewards do not change mastery |

## Proposed architecture

Retain `server/game-modes.ts` pure scoring and existing live engine. Add an economy action reducer only where existing purchase code lacks explicit replay/concurrency invariants. Contract: `{requestId, questionIndex, upgrade}` → `{revision,balance,inventory,effect}`; never accept a balance, price or player ID as authority. Bound currency and inventory; derive allowed action from room role/state. Store transient economy in the room, not study tables. No real money, ads, random paid packs or blockchain. Original cosmetic assets can be an independent later assignment; not required for core play.

A mode descriptor should declare supported question kinds, player count, team support, scoring label and accessibility alternative. Share canonical question projections across modes; separate animation/presentation from correctness. Team reports may show aggregate results but must not expose account identifiers or private documents to guests.

## Specific tests, budgets and limits (DESIGN, unrun)

- Earn 60 coins, submit two simultaneous focus purchases at cost 60: one effective debit, one owned effect, balance never negative. Repeating same request returns prior result; reused ID with changed payload conflicts.
- Focus bonus is consumed exactly once on the next eligible correct answer; guard protects one miss; wrong answers do not fabricate coin rewards. Exhausted inventory gives clear error.
- Two rooms and two players never share wallets. Changing client-supplied balances/prices has no effect. Expired credential cannot buy. Game results cannot update FSRS schedules.
- Buzzer ordering, late answer, team tie and wager bounds remain covered by existing tests plus any changed-contract cases. Test every declared question-kind/mode pair and reject unsupported combinations before start.
- Shop supports keyboard navigation, visible focus, effect text, disabled-state reason and screen-reader balance announcements. Avoid flashing or random motion as essential feedback.
- Proposed staging gate: 100 participants submitting 2 purchase requests/s each for 30 s, p95 acknowledgment <300 ms at 100-ms RTT, zero negative balances, bounded dedup storage and no event-loop stall >200 ms. Record environment and actual results; this research did not load test.

G2 must first open demo hosting; G9 addresses economy invariants after measuring existing behavior. No global progression economy or Blooket-scale minigame suite is claimed complete.

## Pinned repository evidence

All listed projects are independently maintained references/alternatives; they are not official competitor source. Metadata and selected files were checked on the research date. “Not archived” is a GitHub flag, not a maintenance or quality guarantee.

### [TacoJack21/BetterBlooket](https://github.com/TacoJack21/BetterBlooket)

- Snapshot: `b95e3817d7d2516c16d91f8869a7847ae990dc71`; not archived; last push reported `2023-06-25T14:55:08Z`; fork flag `False`.
- License: **NOASSERTION**. Root license files inspected: `LICENSE`. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`src/pages/dashboard/SetCreator.jsx`](https://github.com/TacoJack21/BetterBlooket/blob/b95e3817d7d2516c16d91f8869a7847ae990dc71/src/pages/dashboard/SetCreator.jsx). The SetCreator component renders a sidebar and literal placeholder text.
- Useful pattern and limitation: React UI recreation. Its license is Stewart Private License, not a standard open-source grant. Source only supports a navigation shell here; no working authoring claim.

### [marty-on-linux/Blooket-2.0](https://github.com/marty-on-linux/Blooket-2.0)

- Snapshot: `c2871461785bb615d2ee7de0ae5a2d71905c6476`; not archived; last push reported `2026-04-04T21:56:21Z`; fork flag `False`.
- License: **none detected**. Root license files inspected: none found. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`Download this folder and run the .html inside/index.html`](https://github.com/marty-on-linux/Blooket-2.0/blob/c2871461785bb615d2ee7de0ae5a2d71905c6476/Download%20this%20folder%20and%20run%20the%20.html%20inside/index.html). prepareGameData shuffles options and remaps the correct answer index; questions load separately.
- Useful pattern and limitation: Small HTML/Node beta called Quizletics in README. Broad README permission text exists but no standalone standard license detected. Mode parity and online hosting not tested.

### [s-tn/Gimkit-Clone](https://github.com/s-tn/Gimkit-Clone)

- Snapshot: `f54cfe33b20306b94be8cc6e5bb33d70a8c2353e`; archived; last push reported `2021-06-18T17:19:57Z`; fork flag `False`.
- License: **none detected**. Root license files inspected: none found. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`index.js`](https://github.com/s-tn/Gimkit-Clone/blob/f54cfe33b20306b94be8cc6e5bb33d70a8c2353e/index.js). Socket handlers relay upgrade, balance, join, start and leaderboard events; questions are sent at connection.
- Useful pattern and limitation: Archived Node/Socket.IO experiment. Client-supplied balances and broad question delivery are counterexamples: our server must compute balances and conceal keys.

### [manjun-stuff/gimkit-clone](https://github.com/manjun-stuff/gimkit-clone)

- Snapshot: `f9c117cf24b00bd8118f022160abeeb6ae9468b0`; not archived; last push reported `2026-10-24T22:21:35Z`; fork flag `False`.
- License: **none detected**. Root license files inspected: none found. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`main.cpp`](https://github.com/manjun-stuff/gimkit-clone/blob/f9c117cf24b00bd8118f022160abeeb6ae9468b0/main.cpp). SDL/WebAssembly source declares question/shop states and a frame-driven game loop.
- Useful pattern and limitation: Author describes a first SDL project. Architectural sketch for isolated modes, not evidence of production multiplayer or faithful Gimkit economy.
