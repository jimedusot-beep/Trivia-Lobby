# Small implementation assignments and acceptance gates

Research snapshot: **2026-10-25**. Trivia Lobby baseline: [`0341181653`](https://github.com/jimedusot-beep/Trivia-Lobby/tree/0341181653c00f0015b71339517bbc71d6530c2a).

Evidence labels: **DOC** = retrieved publisher documentation; **SRC** = inspected pinned source, not executed; **TEST** = command actually run; **DESIGN** = original proposed behavior, not a competitor claim. A file existing is not proof its feature works. None of the competitor applications were run, and no proprietary implementation was inspected. See [comparison and validation](REA_FEATURE_COMPARISON.md) for shared limits and [assignments](REA_IMPLEMENTATION_ASSIGNMENTS.md) for delivery contracts.

## Sources and method

This plan is **DESIGN** derived from the pinned DOC/SRC evidence and baseline tests in [comparison](REA_FEATURE_COMPARISON.md). Topic contracts: [Kahoot](REA_KAHOOT_GAMEPLAY.md), [Duolingo](REA_DUOLINGO_LEARNING.md), [party](REA_HEADS_UP_CHARADES.md), [educational modes](REA_EDUCATIONAL_GAMES.md), [study](REA_STUDY_PLATFORMS.md). These links contain source/license/status evidence and limitations; no assignment assumes competitor runtime parity.

No implementation is included in Task 0. Owners below are proposed developer responsibilities, not agents that were launched or assigned remotely. Use one small branch/PR per slice, rebase against latest main, and inspect accepted work before changing a shared file.

## Execution order and conflict controls

1. G0 freezes the public-content/progress contracts with small original fixtures. G1 and G5 can then proceed independently; G3 depends on the same content contract.
2. G2 extends live demo creation after G0/G1; G4 adds local learning storage after G0/G3; G6 builds local party UI after G5. These are the first complete guest journeys.
3. G7 validates those journeys. G8 motion and G9 economy are later focused enhancements, not prerequisites to initial guest release.
4. G10/G11 enhance the private study library independently. They must not block shipping a safe curated public demo.

A contract owner coordinates `shared/game-protocol.ts`, `client/src/App.tsx` and the public catalog. Live transport owner alone changes `server/live-game.ts` during G2/G9. G5 owns a new pure reducer; G6 consumes it without changing live rooms. Do not create competing auth helpers or duplicate the canonical question schema. Explicitly review changed types before integrating branches; integration owner runs a combined browser regression after independent units pass.

## Common definition of done

Every slice supplies original code and content, acceptance tests for observable behavior, error states and denied actions, relevant regression results, accessibility checks, measured performance where applicable, and a short statement of what was not tested. Keep private auth intact. New data formats have schema/version bounds; operations are idempotent where repeatable. Do not mark a criterion passed based on its test existing. Documentation or a mocked service alone cannot prove an end-to-end journey.

## G0 — Public demo contract and original content

- **Proposed owner:** TypeScript/content architect. **Dependencies:** None.
- **Scope:** New `shared/public-demos.ts` and original demo fixtures; adapt `shared/universal-questions.ts` by composition, not schema replacement.
- **Behavior and architecture:** Create 2 original quiz/learning packs of 10 questions each and 1 original 30-clue family-safe party pack. Each manifest has stable ID, version, title, attribution/license and supported activities. Define public/owner content reference union; public catalog never contains private IDs, URLs or account text.
- **Functional acceptance:** Validate every fixture and attribution; deterministically reject duplicate IDs, unsupported kinds, missing versions and private source references. Snapshot public projection to prove solution/source metadata policy. A demo lookup by numeric private deck ID returns not found.
- **Performance / accessibility gate:** Keep initial public catalog+selected pack ≤100 KB compressed; validate 1,000 fixture items in <100 ms on recorded CI runner. Targets are provisional until measured.
- **Handoff and limits:** Export manifest types and loader API; freeze IDs/versioning before G1/G2/G3/G5. No DB migration or auth changes.

## G1 — Public landing and demo selection

- **Proposed owner:** React/accessibility developer. **Dependencies:** G0.
- **Scope:** `client/src/App.tsx`, new public landing/demo route and minimal navigation components.
- **Behavior and architecture:** Make `/` useful without an account: Try quiz, Study demo, Party game, Join with code, and a separate Private library entry. Keep every private route guarded. Selecting a demo passes manifest ID/version, not a private deck ID. Clear loading, empty and retry states.
- **Functional acceptance:** Fresh no-cookie browser loads catalog without a login dialog; keyboard selects all public activities. Private library still asks for authentication. Direct unknown demo URL gives recoverable not-found. Browser back preserves selection.
- **Performance / accessibility gate:** Production mobile profile: LCP ≤2.5 s and CLS ≤0.1 at 360 px, documented device/network; initial JS budget must not regress measured main by >10%. Do not call a target measured until a trace exists.
- **Handoff and limits:** Coordinate the single router edit. Link placeholders only when downstream slice is integrated; hide unavailable launch actions with explanation.

## G2 — Guest live-demo hosting and moderation

- **Proposed owner:** WebSocket/backend developer. **Dependencies:** G0/G1.
- **Scope:** `shared/game-protocol.ts`, `server/live-game.ts`, host UI and room projections.
- **Behavior and architecture:** Add demo-only anonymous create message and reuse hashed/rotated host capability. Preserve authenticated private-host creation. Add only missing lock/remove controls after checking existing actions. Rate-limit anonymous room creation; expire dead rooms. Public names never authorize operations.
- **Functional acceptance:** Two clean clients complete lobby→question→reveal→leaderboard→finish. Private deck create/read denied. Deadline±1 ms, duplicate answer/timeout race, two-room isolation, forged resume, rotated token, player start/kick and pre-reveal key scan all pass.
- **Performance / accessibility gate:** 100-player staging gate from Kahoot document: p95 join <500 ms, answer <300 ms with 100-ms RTT and 0 duplicate awards/key leaks. Record hardware and 20-question run.
- **Handoff and limits:** Live transport owner coordinates G9. Do not claim restart recovery for in-memory rooms; return an honest expired-room message.

## G3 — Short public lesson and practice runner

- **Proposed owner:** Learning/React developer. **Dependencies:** G0/G1.
- **Scope:** New demo lesson runner; reuse `client/src/lib/practice.ts` and existing question UI where compatible.
- **Behavior and architecture:** Five-question recall lesson with explicit feedback, bounded retry of misses, first-pass summary and optional next lesson. Keep local XP separate from server/competitive totals; no hearts or registration gate. Start with memory state; storage supplied by G4.
- **Functional acceptance:** Fixture with two misses produces 5 first-pass attempts+2 retries, accuracy 3/5; repeated submit/Continue is idempotent; empty/unsupported questions fail before session starts. Keyboard feedback focus and reduced motion pass.
- **Performance / accessibility gate:** Input-to-feedback <100 ms on recorded midrange phone; no navigation task >200 ms. Measure a production build with representative content.
- **Handoff and limits:** Expose pure lesson reducer/event adapter for G4. Do not fork grading logic from canonical universal questions.

## G4 — Device-local guest progress and spaced review

- **Proposed owner:** Storage/learning developer. **Dependencies:** G0/G3.
- **Scope:** New IndexedDB GuestProgressStore and browser-safe pure scheduler adapter; existing account scheduler stays pinned.
- **Behavior and architecture:** Persist lesson events, optional daily goal and versioned due schedule for public packs. Export/reset; bounded imports; memory-only fallback with visible status. No automatic upload or account merge. Explain device-only retention.
- **Functional acceptance:** Reload after feedback resumes exactly once; denied/quota/corrupt storage does not block play. Export/import round-trips; malformed import leaves data untouched. Scheduler time/rating fixtures, duplicate IDs with changed payload, DST/midnight/timezone and content-version changes pass.
- **Performance / accessibility gate:** 1,000 events/items: p95 mutation and due selection <100 ms on recorded phone; page at most 100 due items. Define a bounded event retention/export policy before schema release.
- **Handoff and limits:** Persist validated normalized events, never cookie/token/private source payloads. Freeze schema and migrations before integration; do not silently upgrade ts-fsrs.

## G5 — Deterministic local party engine

- **Proposed owner:** Game-systems TypeScript developer. **Dependencies:** G0.
- **Scope:** New `shared/party-round.ts` and focused reducer tests; no router/live-game edits.
- **Behavior and architecture:** Implement setup/handoff/countdown/active/paused/summary/finished, seeded nonrepeating queues, two-team fair rotation, Correct/Pass, explicit exhaustion, deadline-bound scoring and one-step undo. Acting and forehead are distinct variants.
- **Functional acceptance:** 3-clue correct/pass/correct fixture scores 2; empty pack cannot start; duplicate action ID scores once. Pause preserves remaining time; late mark/expiry race ends once; fair equal turns/ties; undo restores state and never extends time.
- **Performance / accessibility gate:** Reducer p95 <5 ms at 500 clues on recorded runner; O(pack size) shuffle at start and bounded per-action work thereafter.
- **Handoff and limits:** Export typed states/events for G6. Local referee marks are self-reported; no AI recognition or online multiplayer in this slice.

## G6 — Button-operated acting and forehead UI

- **Proposed owner:** Mobile/accessibility React developer. **Dependencies:** G1/G5.
- **Scope:** New public `/party` UI consuming reducer; route edit coordinated with G1 owner.
- **Behavior and architecture:** Nicknames only, rule preview, handoff privacy screen, large clue text, visible Correct/Pass/Pause, round/match summaries and play again. Local background auto-pause. Untimed/touch-only option; no camera/microphone.
- **Functional acceptance:** Clean browser completes 2-team/2-turn match with keyboard and touch. Hidden actor clue not in guesser surface/accessible name. Reload restores privacy handoff. Backgrounding freezes local time; denied fullscreen/orientation does not block play.
- **Performance / accessibility gate:** Feedback within 100 ms; 320 px/200% zoom has no clipped critical controls. Run axe plus keyboard and screen-reader trial; record device and remaining issues.
- **Handoff and limits:** Do not overload the existing quiz party mode or require sensors. G7 tests the integrated browser flow.

## G7 — Integrated guest/private regression and measured release gates

- **Proposed owner:** QA/integration engineer. **Dependencies:** G1/G2/G3/G4/G6.
- **Scope:** New focused Playwright journeys alongside existing `e2e/`; staging load harness if live hosting ships.
- **Behavior and architecture:** Test no-sign-in quiz hosting/joining, lesson reload, local party match and protected private library in clean contexts. Validate payload privacy, stale links, keyboard/reflow and degraded storage/network. Review combined router/protocol changes.
- **Functional acceptance:** All common guest journeys pass without credentials; private read/write/source/history remain denied; guest IDs never grant owner access. Record screenshots/trace for failures, network frames for key-leak assertions and manual screen-reader evidence.
- **Performance / accessibility gate:** Apply topic p95 budgets using fixed documented hardware/network/build and enough samples; report real results, not threshold-only assertions. No claim of all-platform sensor compatibility.
- **Handoff and limits:** Run `npm test`, `npm run check`, relevant browser suite and database integrations when private APIs changed. Record skipped checks and environment requirements explicitly.

## G8 — Optional motion control adapter

- **Proposed owner:** Mobile browser developer. **Dependencies:** G5/G6/G7.
- **Scope:** New motion hook/adapter and optional settings control only.
- **Behavior and architecture:** User-triggered permission; calibrated tilt emits the same mark action as buttons. Neutral reset, dwell and debounce; disabled while paused/hidden; unavailable sensor gives a usable touch fallback.
- **Functional acceptance:** Synthetic tilt jitter/held angle produces one action until rearmed; denied permission still finishes match. Physical iOS Safari and Android Chrome calibration/rotation trials required; report exact devices/browser versions.
- **Performance / accessibility gate:** No >1 action per intended tilt; p95 intended tilt-to-feedback <300 ms on tested devices; terminate subscriptions on route exit. Tune initial thresholds from measurements.
- **Handoff and limits:** Optional enhancement only; not a blocker to button release. Do not add recording or analytics SDKs.

## G9 — Workshop purchase replay and economy invariants

- **Proposed owner:** Game backend developer. **Dependencies:** G2; coordinate live engine owner.
- **Scope:** Existing `server/game-modes.ts`, purchase handler and schema; add only missing invariants.
- **Behavior and architecture:** First test current workshop behavior. Add atomic purchase/dedup/revision protection if absent; compute all prices/balances server-side. Preserve existing focus/guard rules and separate study mastery. Explain costs/effects in UI.
- **Functional acceptance:** 60 coins + two simultaneous 60-coin purchases yields one debit/effect; same request replays same result, conflicting payload rejects. No cross-room wallet, negative balance, late purchase or client balance authority. Score modifiers consume once.
- **Performance / accessibility gate:** 100-player×2 requests/s×30 s proposed gate: p95 <300 ms, no ledger invariant failure, bounded dedup memory. Run only on authorized staging.
- **Handoff and limits:** No new global currency, copied art or real-money economy. If current behavior already satisfies a criterion, document passing evidence and avoid needless rewrites.

## G10 — Source citation integrity and draft review

- **Proposed owner:** Private study/backend developer. **Dependencies:** Independent; inspect latest accepted source work.
- **Scope:** Existing `server/study-drafts.ts`, source extraction/reference schema and LearningSources UI.
- **Behavior and architecture:** Extend only missing source-version/offset validation. Quote membership and human approval must remain distinct from entailment. Show exact source passage; unsupported evidence cannot publish. Preserve owner checks and manual authoring when AI unavailable.
- **Functional acceptance:** Wrong owner/source ID denied, quote absent rejected, source replaced causes conflict, duplicate publish idempotent. Irrelevant but present quote is not called verified. Malicious source instructions treated as data; parser/AI failure preserves original.
- **Performance / accessibility gate:** UI acknowledgment <500 ms independent of extraction; bounded job concurrency/timeouts based on current parser limits. Measure representative PDF/text sizes; no OCR claim without an OCR test.
- **Handoff and limits:** Private-only enhancement; never expose uploads to anonymous demo APIs. DB migration and integration tests required if source-reference schema changes.

## G11 — Owner-scoped library folders

- **Proposed owner:** Private library/full-stack developer. **Dependencies:** Independent after current schema/open-PR check.
- **Scope:** New folder/membership migration and owner-scoped routes; existing Library UI.
- **Behavior and architecture:** Add simple single-level folders first: create/rename/move/search and remove folder while retaining files/decks. Do not implement nested cycles until separately specified. Preserve original files and private identities.
- **Functional acceptance:** Blank/duplicate-name policy explicit; user A cannot read/move/delete B membership. Removing folder retains files/decks and history; delete races leave no dangling references; search and empty-state keyboard journey passes.
- **Performance / accessibility gate:** Paginate folder membership; proposed p95 list/search <300 ms for 1,000 owner items on documented staging DB, indexed owner/folder keys; record query plan and measured results.
- **Handoff and limits:** Do not rewrite file storage or promise permanent retention. This slice can ship independently of guest play after authorization/integrity tests.

## Research-to-implementation handoff

Before coding each slice, verify its linked source paths and latest-main status, then select one ambiguous behavior that would change design. Resolve that ambiguity with permitted public observation or a focused source experiment if tooling is available; record any remaining unknown. Do not re-open a broad ten-platform survey before every PR. Each implementation PR links its assignment, tests actually run and intentional differences. Existing private account protections and guest product requirements are release constraints throughout.


## Follow-up: party references, without blocking the guest release

See [new reference extraction](REA_PARTY_REFERENCE_EXTRACTION.md) for pinned sources, license/status limitations, corrected claims and one tested scoring function. G0–G7 stay the immediate guest-delivery sequence. G5/G6 should additionally study ubat and Charades Expo; the latter's incomplete tilt/sound implementation strengthens the existing touch-first decision. Do not add a mandatory competitor integration.

### G12 — Party session survives game changes

Proposed owner: live transport developer; depends on G0/G1/G2 and G7's first public online journey. Add PartySession/MatchInstance separation and an allowlisted activity descriptor. Preserve roster/code and credentialed host authority on return-to-party; invalidate prior match actions and cancel timers. Coordinate live-game/protocol edits with G2/G9. Keep private hosting and account routes protected.

Acceptance: two clean clients finish a demo, return to party and begin another without re-entering nickname/code. Stale match answer/start, forged host parameter and duplicate switch request cannot change current state. A failed adapter launch retains the party with a recoverable status. Enforce player bounds server-side and test min−1/min/max/max+1. p95 switch acknowledgment target <500 ms at 100-ms RTT for 8 players, measured on documented staging; no load result is claimed yet.

### G13 — Prompt Duel, one original writing/voting round

Proposed owner: game reducer/backend developer with UI developer; depends on G12 and frozen projection contract. Implement the bounded three-to-eight-player writing/voting/reveal contract in the new extraction document with original prompts. One PR may deliver a pure reducer and fixtures; a second adds public UI/transport after reducer acceptance. Reuse validation/credentials, not a third-party stack or answer-text identity.

Acceptance: balanced prompt assignments, anonymous responses, no self-vote, deadline and missing-response rules, stable duplicate-text IDs, duplicate-vote idempotency, reconnect projection and one final award per vote. Test all boundaries in reducer plus a three-client browser journey and keyboard-only voting. p95 acknowledgment target <300 ms at 100-ms RTT for 8 players. Humor votes never update factual correctness or FSRS. Source licenses without a clear grant are reference-only.

### G14 — Trace fixtures for new mode transitions

Proposed owner: QA/game-systems developer; can begin with G5 or G13's contract. Store sanitized action/clock/content fixtures and independent expected state/projection assertions. Include phase close races, duplicate delivery, reconnect and stale-match events. Report the first divergence; don't compare only a function to itself or remove security fields during normalization. Test that an intentional double-award or pre-reveal author leak makes the harness fail. Run representative fake-clock traces in <1 s on a documented CI runner; retain a separate real-browser scenario. Never store tokens or private document text in fixtures.

Bluff & Learn, Clue Scale and Sketch Relay remain scoped future mode proposals, not concurrent prerequisites. Promote only one after the first shared-party writing/voting journey passes. Content filters/aliases are small extensions to existing manifests and canonical acceptedAnswers, not new competing storage systems.
