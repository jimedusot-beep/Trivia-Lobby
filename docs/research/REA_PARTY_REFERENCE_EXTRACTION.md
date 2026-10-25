# Party-game references: what Trivia Lobby should adopt next

Research date: **2026-10-25**. Compared against main `0341181653c00f0015b71339517bbc71d6530c2a`, fetched again during this follow-up. This supplements [the feature comparison](REA_FEATURE_COMPARISON.md) and [implementation assignments](REA_IMPLEMENTATION_ASSIGNMENTS.md).

Evidence: **SRC** selected pinned files inspected, **DOC** author/publisher report, **TEST** executed check, **DESIGN** our proposed behavior. No competitor service API was contacted, no full competitor game was run, no REA runtime was available, and no source/assets were copied into the product. A repository being real does not establish working compatibility, secure authorization or a reuse license.

## The most useful things to take

| Priority | Reference | Original Trivia Lobby outcome | Evidence-based decision |
| --- | --- | --- | --- |
| First | Rocketcrab | One code and nickname roster that survives switching activities | Party lifetime and match lifetime must differ; preserve existing private-host authority |
| First | ubat + Charades Expo | Button-operated timed guessing/acting with custom packs | Ship touch/keyboard first; motion is optional, separately tested |
| Next | Quiplash-JS | “Prompt Duel”: write responses, vote anonymously, reveal authors/results | New creative-submission state machine; existing quiz choice grading cannot represent this |
| Next | Fibbage Tribute | “Bluff & Learn”: invent decoys, choose truth, explain it afterward | Truth, decoy ownership and voting must stay on the server until reveal |
| Later | Longwave | “Clue Scale”: one clue giver knows a hidden target; team guesses | Role-specific payloads are essential; hidden CSS does not conceal network data |
| Later | DrawPhone | “Sketch Relay”: alternate drawing and interpreting before a final gallery | Needs bounded media and accessible participation alternatives; not a small quiz setting |
| Throughout | DX-Ball / Zelda3 / TH04 | Replayable tests for scoring, timing and state transitions | Adopt the validation method; binary equivalence is unnecessary for original web mechanics |

The simplest intended product flow is **Start a party → share one code → nickname join → choose a game → play → return to the same party**. Keep Study Demo equally direct from the public landing. Do not add ten new choices before that first journey works.

## Corrections to the supplied list

- The historical Kahoot and Trivia Crack projects inspect protocols/APIs; neither establishes a full current replacement. We need their boundary/testing lessons, not external-service compatibility. Kahoot-hack's abuse utilities are outside our product scope.
- The Drawful project is an editor for existing game data; Jackbox API RE describes a future private server. Neither proves a completed standalone Jackbox implementation.
- DX-Ball's inspected README now claims substantially broader authored-code reconstruction than a single sound function, while listing remaining play validation. Treat this as a report, not a result reproduced here.
- The supplied Charades README advertises tilt/sound, but its inspected game screen contains incomplete sensor branches and audio TODOs. Native SQLite source is not proof browser offline storage works. Its MIT badge lacks a detected root license file.
- Rocketcrab's template documents min/max players but explicitly says enforcement is not implemented there. Our catalog must enforce those bounds on the server, not merely display them.
- Fibbage Tribute is flagged as a fork and its README points to another upstream. Track provenance rather than counting fork and parent as independent implementations.
- The same RSDKv4 engine appears twice for Sonic 1/2 in the supplied count: 20 game names is not 20 independent codebases. The remaining Mario/Zelda/Pokémon/Sonic/Diablo reconstructions are useful methodological leads; they were not all individually audited in this follow-up and are not dependencies to import.

## Shared party architecture (DESIGN)

Keep current `server/live-game.ts` and `shared/game-protocol.ts` as the tested quiz foundation. Main currently has `classic|teams|buzzer|wager|workshop|party`, where party is a scoring variation; no creative answer/vote schema or launcher-level party session was found in these inspected modules. `CREATE_ROOM` still resolves an account and private deck, while nickname joining is public. G0–G2 remain prerequisites to public online play; do not bypass authorization by allowing anonymous access to a private deck ID.

Introduce a `PartySession` only when the existing public demo path is ready: party ID/code, participant capabilities, host capability, roster revision, selected activity and active match ID. A `MatchInstance` holds its own activity/version, content snapshot, phase, revision, deadline, score and private submissions. Selecting a new game creates a new match ID; party code/roster survive, previous timers stop, and old-match actions reject. Show a clear exit/return status to everyone. Host disconnect/resume uses existing capability principles; a nickname or `ishost=true` query parameter never authorizes host actions.

Use a fixed allowlisted activity registry with player bounds, supported content, rule summary and host/player view adapters. For our own games, use same-origin components and the current transport rather than embedding arbitrary iframe URLs. External launcher integration can be separately specified later. Neither adopt third-party Next.js/Firebase/Socket.IO stacks wholesale nor replace the working WebSocket protocol just to match a reference.

Each action carries protocol version, party/match identity, phase revision and request ID; actor authority comes from the connection credential. Validate length and role before storing text. Snapshot functions intentionally project host, player and observer data. Apply bounded replay caches and room expiry; don't record full player messages or tokens in debug logs.

## Three focused future feature contracts (DESIGN)

### Prompt Duel

Start with 3–8 participants. Server pairs each prompt with two authors. Writing → voting per prompt → reveal → next prompt → final summary. Each author submits one ≤240-character response to their assigned prompt before deadline; revisions are allowed until the phase closes. Unsubmitted responses become explicit abstentions. Vote choices use opaque response IDs; voters see text without authors. Authors cannot vote on their own matchup. Each eligible player votes once per matchup; duplicate request ID replays the acknowledgment. Two missing responses skip that matchup; a single response is displayed without a fabricated vote victory. Proposed scoring is 100 points per valid received vote; tie has no extra bonus. These are original rules, not claims about commercial Quiplash scoring.

Host can remove an inappropriate response before voting; content is plain text. Exclusion/abstention must explain why a control is unavailable. Server closes a phase by deadline or all currently eligible submissions; disconnect does not prolong it forever. Caption/text-only play remains fully functional. No humorous response is certified as correct knowledge or imported into study memory.

Acceptance: 3/4/8-player assignment fixtures give balanced author slots; ineligible/self/stale/replayed votes cannot score; duplicate answer text preserves separate opaque IDs; two simultaneous close triggers reveal once; reconnect reveals only the current role projection. Pre-reveal frames contain no author map. Proposed staging target: 8 players, p95 submit/vote acknowledgment <300 ms at 100-ms RTT on documented hardware. Not measured here.

### Bluff & Learn

Use curated original, cited factual prompts. Writing → choices → reveal/explanation → next. Each player may submit one plausible decoy, not the known answer. Normalize Unicode, whitespace and case before comparing; equivalent decoys merge into one choice with a private owner set. A server-owned truth choice is inserted and choices shuffled; never ship ownership or a truth flag before reveal. One decoy per author and one vote per eligible player; self-owned choice cannot be selected. If fewer than two distinct accepted decoys exist, use original curated fallback decoys or skip with a clear message. Proposed scoring: 100 for truth and 50 per opponent fooled, split with deterministic rounding among merged-decoy authors. Keep scores independent of study mastery.

Acceptance: truth-equivalent decoy rejects, duplicate decoys do not reveal owners, HTML is literal text, repeated votes cannot pay twice, merged-owner self-vote rejects, stale match ID rejects, timeout with missing submissions advances once. Explanation includes original curated attribution. Test owned code under staging load; do not exercise public third-party rooms.

### Reproducible state traces

For each new mode, freeze an initial state, original content version, seeded RNG, clock timeline and typed action sequence. Compare expected state/projections after each action. Fixtures cover deadline edges, duplicate delivery, reconnect, host loss, return-to-party and switching activity. Normalize only nondeterministic IDs/timestamps explicitly; never normalize away changed scores or leaked fields. A simple independent fixture expectation should supplement replaying an implementation against itself. Replaying the same faulty code twice is not an oracle.

Use fake clock/scheduler tests plus separate real browser journeys. Failed traces report the first divergent action and a sanitized state diff. Bound the trace size and omit tokens/private documents. This takes the validation discipline from reconstruction projects without copying their code, assets or quirks.

## Content and accessibility improvements from the smaller investigations

The [Champ'd Up investigation](https://danq.me/2026/09/19/us-centric-according-to-champd-up/) reports inspecting JSON metadata to see how a regional content flag works. The useful lesson is to make our own filters explicit and test their meaning, rather than presume one regional label means universal suitability. Proposed prompt metadata: language, locale tags, age suitability, topic, source/license and text-only alternative. Guests choose a pack and can see why a filter leaves no playable prompts. Do not copy its published commercial prompt list.

Drawful's alternate-spelling field reinforces using a list of accepted aliases for factual short answers. Trivia Lobby already has `acceptedAnswers` in `shared/universal-questions.ts`; extend editor/import validation only where missing, rather than creating another answer representation. Display a reviewable import preview, apply bounded schema validation, and ensure failed imports leave current data unchanged.

All new activities require labeled controls, visible focus, text feedback, 44 px touch targets and reduced motion. Don't depend on sound, speed, device tilt or fine pointer movement. Sketch Relay needs an explicit text-only role/variant and bounded media before scheduling implementation. Room secrecy must hold for network payloads and accessible text alike.

## Validation and limitations

**TEST:** executed Longwave's unmodified pinned `GetScore.ts` through the existing tsx runtime with nine independent boundary fixtures (exact hit, just below/at distance 1, just below/at/above distance 2, symmetry and endpoints). All nine passed; an additional assertion confirmed NaN propagates. This verifies only that small function. The first ESM named-import attempt failed because of the reference package's module format; rerun via Node createRequire succeeded. Our future input schema must reject nonfinite/out-of-range values before scoring. No claim about its complete game or server privacy follows.

**DOC:** [REA TH04 case study](https://rea.tools/showcase/th04/) reports inspection of a bullet-angle helper and recorded compiler checks for containing bullet-generation code; this is narrower than whole-game parity. [Zelda3 README](https://github.com/snesrev/zelda3) describes side-by-side per-frame RAM comparison and input-history replay. Those workflows were read, not executed. [OpenTTD](https://github.com/OpenTTD/OpenTTD) was checked only at project-description level; deeper networking architecture claims are deferred.

No competitor dependency installs, native games/ROMs, commercial assets, hosted rooms, browser/sensor runs or load tests were used. Existing 68-test/TypeScript results in the initial Task 0 report remain baseline results, not new tests of these proposals. This follow-up changes research documents only. Documentation validation resolved 64 pinned source paths and 29 relative links across all eight REA documents; staged whitespace validation passed. The next implementation should complete a small guest journey under G0–G7, then add the party-session/prompt-vote slice below; more legacy game research does not block it.

## Pinned source and status ledger

Root license text was read where present. Metadata flags and last-push dates are snapshots, not maintenance guarantees. Each SRC link identifies the selected file inspected; no source is treated as a tested complete replacement.

### unixpickle/kahoot-hack

[Historical protocol client — selected file](https://github.com/unixpickle/kahoot-hack/blob/837ffedbc5ed971e9460d47bbe08fade1fa9056f/kahoot/quiz.go); SHA `837ffedbc5ed971e9460d47bbe08fade1fa9056f`. License metadata **BSD-2-Clause**; root license files: LICENSE; archived `False`; fork `False`; pushed `2021-01-15T15:15:35Z`.

**SRC/DOC:** Separates intro and answerable events, validates packet shape/index and waits for a submission acknowledgment. README also includes abuse tools. **Takeaway/limit:** Use explicit typed phases and acknowledgments in our own protocol. Do not integrate external API dependence or port abuse commands; current Kahoot compatibility was not tested.

### davidkus/triviacrack

[Undocumented API wrapper — selected file](https://github.com/davidkus/triviacrack/blob/fe2daf213573785accac743dae98d3b92cf3ae10/lib/triviacrack/api/game.rb); SHA `fe2daf213573785accac743dae98d3b92cf3ae10`. License metadata **MIT**; root license files: LICENSE.txt; archived `False`; fork `False`; pushed `2026-04-03T20:33:34Z`.

**SRC/DOC:** Separates game/dashboard requests from parsers and domain objects; README warns undocumented API may change. **Takeaway/limit:** Use transport/parser/domain boundaries for our own game state. This is not a standalone Trivia Crack game, and is not evidence for recreating wheel/category reward rules.

### misc0110/JBPPDrawfulQuestionEditor

[Content-format editor — selected file](https://github.com/misc0110/JBPPDrawfulQuestionEditor/blob/e54eb0775702c34d8cd5354a795191c621060c36/drawful.py); SHA `e54eb0775702c34d8cd5354a795191c621060c36`. License metadata **none detected**; root license files: none detected; archived `False`; fork `False`; pushed `2020-10-21T18:32:02Z`.

**SRC/DOC:** Declares question and index templates with prompt text and alternate spellings; authoring is separate from gameplay. **Takeaway/limit:** Add validated original prompt packs and accepted aliases. Do not distribute commercial questions/assets or add a Jackbox archive importer to the guest slice.

### SergeyMC9730/jackboxapi-re

[Endpoint investigation/client bridge — selected file](https://github.com/SergeyMC9730/jackboxapi-re/blob/1bbb6d3565dfefafdf2fd9d1d4c5e3bd537dd0da/japi.js); SHA `1bbb6d3565dfefafdf2fd9d1d4c5e3bd537dd0da`. License metadata **MIT**; root license files: LICENSE; archived `False`; fork `False`; pushed `2024-08-12T16:51:48Z`.

**SRC/DOC:** Room model includes lock/full/moderation/language/reconnect fields; README calls a private server a theoretical future result. **Takeaway/limit:** Model explicit room admission reasons. A parsed field is not proof the behavior is implemented securely; no completed private server claim.

### matzebond/ubat-game

[Browser forehead-game adaptation — selected file](https://github.com/matzebond/ubat-game/blob/b73c9f7cce56a7cd949bbf591a5cb1091dd86160/src/client/pages/Game.js); SHA `b73c9f7cce56a7cd949bbf591a5cb1091dd86160`. License metadata **AGPL-3.0**; root license files: none detected; archived `False`; fork `False`; pushed `2018-11-05T02:44:05Z`.

**SRC/DOC:** Shuffles selected entries, tracks solved/skipped, adds/removes motion listeners and has visible skip controls. Timer increments UI progress. **Takeaway/limit:** Browser-native input fallback and category packs are relevant. Prefer monotonic/deadline time over accumulated intervals; no current sensor compatibility verified.

### darekdeo/charades

[Expo recreation with incomplete advertised features — selected file](https://github.com/darekdeo/charades/blob/5af1af75b21b82fc850d0aabb737436dd85dd4bc/src/screens/GameScreen.tsx); SHA `5af1af75b21b82fc850d0aabb737436dd85dd4bc`. License metadata **none detected**; root license files: none detected; archived `False`; fork `False`; pushed `2026-10-17T14:03:52Z`.

**SRC/DOC:** Touch correct/pass and countdown/game/results state exist. Sensor code has unresolved direction comments and no implemented correct-tilt branch; playSound contains TODO/commented audio code. **Takeaway/limit:** Touch-first play is the credible reference. README MIT badge is not a root license grant: no LICENSE/COPYING file found in inspected tree. Database.ts uses Expo SQLite; it does not establish browser offline support.

### simondiep/quiplash-js

[Prompt-answer-vote party recreation — selected file](https://github.com/simondiep/quiplash-js/blob/4494578bf25e7b20e3cecd2312d4cff67b94f772/server/state/PromptsAnswersVotes.js); SHA `4494578bf25e7b20e3cecd2312d4cff67b94f772`. License metadata **none detected**; root license files: none detected; archived `False`; fork `False`; pushed `2023-04-04T16:26:04Z`.

**SRC/DOC:** Assigns paired prompts to players, stores submissions/votes, then computes winners/ties. Votes append names; duplicate answer text gets a suffix. **Takeaway/limit:** Use opaque submission IDs, per-voter authorization/idempotency and anonymous reveal. Do not key authority by answer text or names. Module inspection is not a full security audit.

### EliotGodard/fibbage-tribute

[Forked Socket.IO bluffing adaptation — selected file](https://github.com/EliotGodard/fibbage-tribute/blob/5da9cb86ad5452238096d5e79b67c4a335716b8c/agxgame.js); SHA `5da9cb86ad5452238096d5e79b67c4a335716b8c`. License metadata **none detected**; root license files: none detected; archived `False`; fork `True`; pushed `2026-02-05T09:01:39Z`.

**SRC/DOC:** Collects ploys and inserts the correct answer into a shuffled list; host/client events drive phases. The inspected module has a shared questions variable. **Takeaway/limit:** Use per-match state, server-owned truth, opaque choice IDs and independent phase deadlines. Do not copy global question state or host-supplied answer lists. GitHub identifies this repository as a fork; README points to Minious upstream.

### cynicaloptimist/longwave

[Team clue/hidden-target adaptation — selected file](https://github.com/cynicaloptimist/longwave/blob/48c4cebe666bd3ff3e9eff0883128ee146a2e140/src/state/GetScore.ts); SHA `48c4cebe666bd3ff3e9eff0883128ee146a2e140`. License metadata **MIT**; root license files: LICENSE.txt; archived `False`; fork `False`; pushed `2025-03-19T22:56:23Z`.

**SRC/DOC:** Pure score function uses absolute target/guess distance, including sharp boundaries; RandomSpectrumTarget.ts produces an integer 0..20. **Takeaway/limit:** Separate hidden role views and validate finite bounded inputs. Its pure scoring function was tested here; its Firebase authorization, full gameplay and secrecy were not.

### 2xlink/DrawPhone

[Drawing/guessing telephone adaptation — selected file](https://github.com/2xlink/DrawPhone/blob/7bde64847df4b832e13eaf827929475c8084123d/main.py); SHA `7bde64847df4b832e13eaf827929475c8084123d`. License metadata **none detected**; root license files: none detected; archived `False`; fork `False`; pushed `2024-10-05T23:55:40Z`.

**SRC/DOC:** Room tracks drawing-vs-text phase and histories; player has prompt/image/readiness. **Takeaway/limit:** Use private per-step assignments and deferred full-chain reveal. Python default UUID arguments are evaluated at definition, so do not reuse that constructor pattern; this is not proof its call sites issue duplicate credentials.

### tannerkrewson/rocketcrab

[Shared lobby and launcher — selected file](https://github.com/tannerkrewson/rocketcrab/blob/5ad9ca69910acb75c140323624603a3d8c966a37/server/rocketcrab.ts); SHA `5ad9ca69910acb75c140323624603a3d8c966a37`. License metadata **MIT**; root license files: LICENSE; archived `False`; fork `False`; pushed `2026-10-25T02:38:42Z`.

**SRC/DOC:** Party state holds a roster and selected game; startGame calls a game connector, records errors; exitGame returns to the party and clears connected-game state. **Takeaway/limit:** Adopt a persistent party identity with replaceable match instances. The template explicitly labels min/max-player enforcement not implemented. Do not turn name/ishost URL hints into authority or embed arbitrary third-party frames.

### N0zoM1z0/dx-ball

[REA reconstruction and comparison methodology — selected file](https://github.com/N0zoM1z0/dx-ball/blob/b7431e07bcb5bd351abe7c7774b692366cba6898/README.md); SHA `b7431e07bcb5bd351abe7c7774b692366cba6898`. License metadata **MIT**; root license files: LICENSE; archived `False`; fork `False`; pushed `2026-10-22T05:05:00Z`.

**SRC/DOC:** Current pinned README reports 270 authored functions and 84,968 authored code bytes exact, plus Wine play checks and remaining validation. This supersedes the pasted narrow sound-panning summary as a report of project scope. **Takeaway/limit:** The transferable pattern is a bounded function contract, oracle fixtures and explicit remaining validation. These are author-reported results; no binary/compiler/Wine checks were rerun here.
