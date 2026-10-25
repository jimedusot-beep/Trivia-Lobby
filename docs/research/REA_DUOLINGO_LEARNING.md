# Learning pathways, daily lessons and guest progress

Research snapshot: **2026-10-25**. Trivia Lobby baseline: [`0341181653`](https://github.com/jimedusot-beep/Trivia-Lobby/tree/0341181653c00f0015b71339517bbc71d6530c2a).

Evidence labels: **DOC** = retrieved publisher documentation; **SRC** = inspected pinned source, not executed; **TEST** = command actually run; **DESIGN** = original proposed behavior, not a competitor claim. A file existing is not proof its feature works. None of the competitor applications were run, and no proprietary implementation was inspected. See [comparison and validation](REA_FEATURE_COMPARISON.md) for shared limits and [assignments](REA_IMPLEMENTATION_ASSIGNMENTS.md) for delivery contracts.

## Sources and observed behavior

**DOC D1:** [Duolingo's introduction](https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/) describes learning activities, XP and streaks. **DOC D2:** [Streak help](https://www.duolingo.com/help/what-is-a-streak) defines consecutive days with lesson completion. These do not reveal production grading, mastery thresholds, experiment variants or unlock algorithms. The independently developed sources below provide implementation examples, not evidence of Duolingo's internal architecture.

## Original lesson contract (DESIGN)

Public landing → pick a topic → see optional ordered lessons → start a five-question session → respond → see correction/explanation → retry misses once → summary → next lesson or review. A lesson is short retrieval practice, not just viewing cards. No hearts gate, paid continuation, forced account creation or removal of earned milestones. Progress is editable local data and has no competitive authority.

| State | Input | Output/transition |
| --- | --- | --- |
| Path | Demo topic/version | Lesson title, prerequisites, completed/current/available labels; replay always allowed |
| Prompt | Select answer or type supported response | Check disabled until valid input; submit once per item |
| Feedback | Graded result | Correct answer and explanation, neutral error wording, Continue button |
| Retry | First-pass misses | Each missed item appears once more after intervening items; first-pass statistics preserved |
| Complete | Last feedback acknowledged | First-pass accuracy, retry improvement, session XP and next action |
| Restore/error | Reload or failed local save | Resume exact session/version if compatible; otherwise explain reset and preserve exportable history |

Rules: proposed initial XP is 10 per unique first-pass correct item plus 5 for finishing a session; retries award no additional XP. Completion event ID is deduplicated. A completed lesson records attempts separately from mastery. Replaying may improve accuracy but does not grant repeated first-completion bonuses. Daily goal defaults to one completed lesson and is optional. Count local calendar dates using a saved IANA timezone; test DST, midnight and timezone changes. Never claim anti-cheat for device-local XP. A break resets the current consecutive count but preserves best streak and achievements.

## Proposed architecture and baseline

`client/src/pages/Learning.tsx` already presents XP, study streak, achievements and per-deck Explore/Recall/Mastery pathways. `server/study-routes.ts` derives account analytics from stored reviews. These are **source-implemented account features**, not a missing progression foundation. The missing slice is a public lesson runner and local progress adapter.

Define `LessonManifest {id, version, title, itemIds, prerequisites}` over public canonical questions and `GuestLessonEvent {id, sessionId, lessonId, version, completedAt, timezone, firstPassCorrect, attempted}`. Store bounded, schema-versioned events in IndexedDB through a `GuestProgressStore` adapter; maintain a memory fallback with visible “this session only” status. Keep optional goal preferences apart from scheduler state. Local demo progress must never be submitted as authenticated achievement evidence. Migration to account, if added later, requires explicit import, provenance and deduplication; no silent merge on sign-in.

## Learning-science constraints

DESIGN rationale: require recall before showing answers, make feedback specific, interleave retries and use delayed due review for retention. XP measures participation, not knowledge. Two correct answers today do not prove long-term mastery; label milestones by their actual criteria. Do not advertise improved retention without a longitudinal comparison. FSRS scheduling and subjective ratings are discussed in the study document; lesson correctness and self-reported recall are separate signals.

## Specific tests and budgets (DESIGN, unrun)

- Five-item fixture with two initial misses produces five first-pass attempts and two retries; summary accuracy remains 3/5. Repeated Continue/completion events do not inflate XP or skip questions.
- Reload after feedback resumes feedback, not a blank prompt with an extra attempt. Changed manifest version explains incompatible resume and leaves prior completion events exportable.
- Denied IndexedDB, quota exhaustion and corrupt dates produce clear nonblocking errors. Guest export/import round-trips validated events; malformed import leaves current data intact.
- Midnight, leap day, DST forward/back and timezone change fixtures preserve one activity day per chosen calendar date. Freeze the clock in tests; no timers sleeping in test code.
- Keyboard covers answer, Check and Continue; focus moves to feedback/next prompt; progress has a textual equivalent. Reduced-motion setting removes celebration effects; no sound required. Manual screen-reader trial required before accessibility claim.
- Local session mutation p95 <100 ms for 1,000 stored events on a specified midrange phone; render one prompt at a time. Proposed interaction response <100 ms and no long task >200 ms during lesson navigation. Measure in a production build, not jsdom.

## Limitations and assignment

No native Duolingo session or experiment was tested. Source clones have authentication or client-only state that conflicts with the guest requirement if copied wholesale. G3 and G4 specify the original lesson/store implementation; G7 covers public accessibility and performance.

## Pinned repository evidence

All listed projects are independently maintained references/alternatives; they are not official competitor source. Metadata and selected files were checked on the research date. “Not archived” is a GitHub flag, not a maintenance or quality guarantee.

### [sanidhyy/duolingo-clone](https://github.com/sanidhyy/duolingo-clone)

- Snapshot: `d74bb88e0a6e2ec35eb9516a5dcb9b45901f3bd0`; not archived; last push reported `2026-10-22T07:35:13Z`; fork flag `False`.
- License: **MIT**. Root license files inspected: `LICENSE`. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`actions/challenge-progress.ts`](https://github.com/sanidhyy/duolingo-clone/blob/d74bb88e0a6e2ec35eb9516a5dcb9b45901f3bd0/actions/challenge-progress.ts). Authenticated challenge progress distinguishes practice from first completion, updates hearts and adds 10 points.
- Useful pattern and limitation: Next.js/Drizzle/Clerk. Source checks hearts and subscription; do not reproduce a pay-to-continue learning gate. Concurrent reward correctness was not tested.

### [bryanjenningz/react-duolingo](https://github.com/bryanjenningz/react-duolingo)

- Snapshot: `2d0fdbca433f36a0e54f56f3cde58ce1080790ba`; not archived; last push reported `2024-09-16T00:49:12Z`; fork flag `False`.
- License: **MIT**. Root license files inspected: `LICENSE`. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`src/stores/createLessonStore.ts`](https://github.com/bryanjenningz/react-duolingo/blob/2d0fdbca433f36a0e54f56f3cde58ce1080790ba/src/stores/createLessonStore.ts). A Zustand slice increments completed lessons and computes jump-to-unit progress from preceding tiles.
- Useful pattern and limitation: React/Next.js client state; lesson completion state is not evidence of secure server grading or durable cross-device progress.
