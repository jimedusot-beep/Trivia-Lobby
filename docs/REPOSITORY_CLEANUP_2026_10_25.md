# Repository cleanup and release readiness — October 25, 2026

**Scope:** GitHub [Trivia-Lobby](https://github.com/jimedusot-beep/Trivia-Lobby). This is a verified audit log, not a claim that the live production environment is fully backed up or that unmerged features are live.

## Actions completed
- Closed [PR #26](https://github.com/jimedusot-beep/Trivia-Lobby/pull/26) as superseded: learner-history migration 0006 and retained-attempt implementation already exist on `main`. Key implementation blob hashes matched.
- Closed [PR #35](https://github.com/jimedusot-beep/Trivia-Lobby/pull/35) as superseded by the patched Zod/body-parser release gate and compressed request rejection on `main`.
- Closed [issue #34](https://github.com/jimedusot-beep/Trivia-Lobby/issues/34) (patched packages, green dependency audit) and [issue #18](https://github.com/jimedusot-beep/Trivia-Lobby/issues/18) (authenticated deck APIs and owner checks); recorded evidence in their threads.
- Merged documentation-only [PR #44](https://github.com/jimedusot-beep/Trivia-Lobby/pull/44) and refreshed/merged REA contributor workflow [PR #43](https://github.com/jimedusot-beep/Trivia-Lobby/pull/43); CI and acceptance verified for #44 and CI for #43.
- Updated remaining open issue bodies (#2, #3, #6, #12, #13, #14, #19) with current context without losing their original acceptance criteria.
- Created [#48](https://github.com/jimedusot-beep/Trivia-Lobby/issues/48) for independent production offsite backups, and [#49](https://github.com/jimedusot-beep/Trivia-Lobby/issues/49) for branch protection.

## Current blockers — DO NOT mark resolved without independent evidence

### Production backup [#48](https://github.com/jimedusot-beep/Trivia-Lobby/issues/48)
The Neon **Free** production branch had no snapshots and no snapshot schedule at inspection time. Scheduled snapshots are not offered on the Free plan. The encrypted GitHub Actions backup job is intentionally skipped unless the operator sets `BACKUPS_ENABLED=true`, and recent scheduled runs were skipped. No real offsite backup or restore rehearsal was verified. Never put backup credentials in git. Complete explicit source-object plus database restore tests before treating production storage as protected; no plan upgrade without the owner's authorization.

### Repository protections [#49](https://github.com/jimedusot-beep/Trivia-Lobby/issues/49)
`main` was reported unprotected, with zero rulesets. Only a GitHub administrator can enable the protection settings and required checks. The current connector does not expose these writes. Avoid direct pushes, unreviewed merges, force pushes, or production redeployments until protection is enabled.

### Multi-game integration
- [#45](https://github.com/jimedusot-beep/Trivia-Lobby/pull/45): guest Quiz, Prompt Duel and Charades; stand-alone checks green; edits the shared lobby/websocket engine.
- [#46](https://github.com/jimedusot-beep/Trivia-Lobby/pull/46): Sprint Trivia and host-only answer progress; standalone checks green; *draft*.
- [#47](https://github.com/jimedusot-beep/Trivia-Lobby/pull/47): Odd One Out and host-reviewed explanation bonuses; standalone checks green; *draft*.
- All three modify `server/live-game.ts`. #46 and #47 also modify `game-modes.ts`, `game-protocol.ts`, `schema.ts`, host UI and socket hook.
- A staging branch `integration/guest-sprint-odd-20261025` was created containing #45 and a **partial** #46 overlay; it is NOT a complete combined implementation, should not be merged or deployed, and must be reconciled, tested, then deleted or replaced by a fully accepted integration PR. #47 is not staged there.
- Do not close #45/#46/#47 until their work has been incorporated and verified in a combined PR. Tests from individual PRs are insufficient.

## Branch archive candidates
At audit, 30 branches belonged to already-merged pull requests. These can be considered for branch deletion once each relevant PR merge, branch HEAD and absence of unique unmerged work are confirmed. GitHub retains merged commits and PR histories.
Additional old branches include the superseded PR #9 and three `ops/*` verification branches. Inspect their unique commits before deleting. The current GitHub connector lacks delete-ref support: **no branches were deleted by this cleanup**. A [dry-run-first verified cleanup helper](../script/cleanup-merged-branches.sh) is available for an authenticated repository administrator: `bash script/cleanup-merged-branches.sh --dry-run`; only after inspecting each eligible branch should they opt in with `--execute`. The helper skips open PRs, non-merged branches and branch refs that moved after the merge.

## Release tag
A release tag should identify an immutable, passing and reviewed **main** commit. Do not label #45-#47 as shipped until combined acceptance is complete. The available connector cannot create Git tags or GitHub Releases; the repository administrator should tag using their standard release process only after verification. No release tag was created in this cleanup.

## Suggested release gates
1. CI and dependency audit pass on the **exact** combined commit.
2. Native PostgreSQL migration, restore, privacy and concurrency tests pass against disposable databases.
3. Chromium, Firefox, WebKit, and at least one real iPhone/Android end-to-end host/guest game pass.
4. No hidden answers or unvalidated client scores leak through guest HTTP/WebSocket routes.
5. Backups, restore evidence, branch protection and human review are verified.
6. Create an annotated release tag; deploy deliberately from the approved commit; check live HTTP, WebSocket, storage and rollback.
