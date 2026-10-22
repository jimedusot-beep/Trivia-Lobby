# PR consolidation for merge

The PRs in the user's screenshot overlapped and use incompatible prototype account, protocol and migration designs. PR #21 is the consolidated implementation. All six earlier branch heads are preserved as ancestors, so merging this result incorporates their history without replaying conflicting implementations over the current app.

| PR | Resolution |
|---|---|
| #5 research and question foundation | Preserve the research catalog and provenance, and main's richer eleven-kind versioned schema, grading and key-free projections. The early narrower schema is superseded by the tested representation. |
| #8 alternate P0 implementation | Retain one private scrypt/session system and the shared versioned match engine. Owner-scoped CRUD, transactional deletion/FKs, secure credentials, cryptographic collision checks and real socket/privacy tests cover its goals. A parallel express-session account system and incompatible event names are not installed. |
| #10 secure multiplayer | Preserve latest branch ancestry and main reconciliation, strengthen socket error handling, and run schema/role/timer/reconnect tests plus actual oversized-frame and missed-round regressions. |
| #11 adaptive study | Already merged upstream; reconcile its newer self-rated-recall wording, strict origin helper, source/draft isolation cases and semantic-heading browser regressions with the unified account model. |
| #15 private library | Preserve its accounts, owner-scoped library, validated retained originals and import review; extend with private storage, extraction/search, editing, deduplication and backups. |
| #20 earlier integration | Port encrypted snapshot recovery and retained-original verification, private/versioned S3 infrastructure template, opt-in backup workflow, streamed AI-response bounds, saved flashcard recall and timing-resistant login. Keep #21's stronger editing, portable formats, answer replay validation, source citations, protocol projection and migration contracts. Preserve the original additional artwork. |
| #21 final integration | Contains the combined source and all heads. Runs unit/socket tests, native PostgreSQL integration/migration and recovery checks, smoke tests and independent Chromium/Firefox/WebKit acceptance jobs before merge. |

All seven screenshot PRs are now marked merged through PR #21 at `e649b07eee0f0a48fe772ca8f39da3817da8f90e`. Its source passed 57 unit/socket tests, five native PostgreSQL database/API scenarios, encrypted database-and-original-file recovery and seven browser scenarios in each of Chromium, Firefox and WebKit (21 total), with retries disabled. The same checks passed after merge in [main acceptance run 39814795907](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/39814795907). TypeScript, build and smoke checks also passed.

The previous acceptance jobs stalled during combined browser installation. The new workflow installs one browser per bounded job, uses per-PR concurrency, and attempts to cancel obsolete acceptance runs. It does not disable the browser checks.

Operational limits remain in [INTEGRATED_PLATFORM.md](INTEGRATED_PLATFORM.md) and [RECOVERY.md](RECOVERY.md). No production database, source bucket, AI key or retention setting is changed by merging this code.
