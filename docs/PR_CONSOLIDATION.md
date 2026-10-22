# PR consolidation for merge

The open PRs in the user's screenshot overlap and use incompatible prototype account, protocol and migration designs. PR #21 is the consolidated implementation. All six earlier branch heads are preserved as ancestors, so merging this result incorporates their history without replaying conflicting implementations over the current app.

| PR | Resolution |
|---|---|
| #5 research and question foundation | Preserve the research catalog and provenance, and main's richer eleven-kind versioned schema, grading and key-free projections. The early narrower schema is superseded by the tested representation. |
| #8 alternate P0 implementation | Retain one private scrypt/session system and the shared versioned match engine. Owner-scoped CRUD, transactional deletion/FKs, secure credentials, cryptographic collision checks and real socket/privacy tests cover its goals. A parallel express-session account system and incompatible event names are not installed. |
| #10 secure multiplayer | Preserve latest branch ancestry and main reconciliation, strengthen socket error handling, and run schema/role/timer/reconnect tests plus actual oversized-frame and missed-round regressions. |
| #11 adaptive study | Already merged upstream; reconcile its newer self-rated-recall wording, strict origin helper, source/draft isolation cases and semantic-heading browser regressions with the unified account model. |
| #15 private library | Preserve its accounts, owner-scoped library, validated retained originals and import review; extend with private storage, extraction/search, editing, deduplication and backups. |
| #20 earlier integration | Port encrypted snapshot recovery and retained-original verification, private/versioned S3 infrastructure template, opt-in backup workflow, streamed AI-response bounds, saved flashcard recall and timing-resistant login. Keep #21's stronger editing, portable formats, answer replay validation, source citations, protocol projection and migration contracts. Preserve the original additional artwork. |
| #21 final integration | Contains the combined source and all heads. Runs unit/socket tests, native PostgreSQL integration/migration and recovery checks, smoke tests and independent Chromium/Firefox/WebKit acceptance jobs before merge. |

Local verification after consolidation: 57 unit/socket tests, five PGlite database/API scenarios and seven Chromium browser scenarios pass, with TypeScript and production build checks. Native encrypted recovery and the complete browser matrix must also pass in GitHub Actions for this revision.

The previous acceptance jobs stalled during combined browser installation. The new workflow installs one browser per bounded job, uses per-PR concurrency, and attempts to cancel obsolete acceptance runs. It does not disable the browser checks.

Operational limits remain in [INTEGRATED_PLATFORM.md](INTEGRATED_PLATFORM.md) and [RECOVERY.md](RECOVERY.md). No production database, source bucket, AI key or retention setting is changed by merging this code.
