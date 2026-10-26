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
**Update verified 2026-10-26 UTC:** a manual snapshot `snap-summer-mud-b4r1p722` (`trivia-pre-release-safety-2026-10-25`) was successfully created and re-listed for production branch `br-super-sea-b43utddf`. At the earlier audit, the Neon **Free** branch had no snapshots or schedule. The current Free plan includes **one manual snapshot**, but still does **not** include scheduled snapshots. This manual snapshot is a same-provider database-only recovery point and is NOT an independent offsite backup, a copy of user-uploaded original files, or verified restore evidence. The encrypted GitHub Actions backup job is intentionally skipped unless the operator sets `BACKUPS_ENABLED=true`, and recent scheduled runs were skipped. No independent offsite backup or isolated restore rehearsal has yet been verified. Never put backup credentials in git. Complete explicit source-object plus database restore tests before treating production storage as protected; no plan upgrade without the owner's authorization.

### Repository protections [#49](https://github.com/jimedusot-beep/Trivia-Lobby/issues/49)
`main` was reported unprotected, with zero rulesets. Only a GitHub administrator can enable the protection settings and required checks. The current connector does not expose these writes. Avoid direct pushes, unreviewed merges, force pushes, or production redeployments until protection is enabled.

### Games — current integration status (verified October 25)
- [PR #45](https://github.com/jimedusot-beep/Trivia-Lobby/pull/45) guest Quiz, Prompt Duel and Charades was merged into main, along with [PR #55](https://github.com/jimedusot-beep/Trivia-Lobby/pull/55) integrating Sprint Trivia and Odd One Out. Original #46 and #47 source PRs were closed as superseded, not merged independently. Current `main` is at `4cb5dba7` (QR/sharing upgrade #58) with CI, Guest Party Engine, and Integrated platform acceptance **all green**.
- [PR #57](https://github.com/jimedusot-beep/Trivia-Lobby/pull/57) implements five family modes; it now has merge conflicts because current main's room invitation code changed. [PR #59](https://github.com/jimedusot-beep/Trivia-Lobby/pull/59) contains the same five plus six additional family modes, rebased to preserve main's newer unified QR invitations. All five checks pass on its verified head `ea373428`.
- **Updated October 26 UTC:** PR #59 was merged into `main` at `ee74bb404c3fca9676c2d0dd6cfeb64b6b4c82fa`, containing 11 social modes plus existing Guest Party games. PR #57 was closed *unmerged* as superseded, retaining its original history. CI and guest-party tests passed post-merge; public deployment and real-device testing remain unverified. The #59 review history contains COMMENTED records but **no independent APPROVED** review. GitHub still permits unreviewed merges because `main` has no protections; see #49.
- Real 10–20 phone smoke with reconnect, timeouts and host display and a public Render deployment/status check still need evidence. The former partial branch `integration/guest-sprint-odd-20261025` is obsolete; never deploy it.

### Operator security and backup procedure (blocked until account configuration)
1. In **GitHub → Settings → Rules → Rulesets**, create a main-branch ruleset (or classic branch protection). Require pull requests before merging, at least one approval by someone **other than the author**, required status checks **CI**, **Guest party engine**, and **Integrated platform acceptance**, and block force pushes and deletions. Verify the final requirement check names in a recent passing run; branch protection remains absent until GitHub confirms `protected: true` or a ruleset applies.
2. The Neon Free branch has no automatic scheduled snapshots and no snapshots. To run encrypted independent offsite backup on GitHub Actions, provision an external private encrypted bucket with access for source objects and a separate backup bucket, and set the repository's `BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE`, `SOURCE_S3_BUCKET`, `BACKUP_S3_BUCKET`, `BACKUP_AWS_ACCESS_KEY_ID`, `BACKUP_AWS_SECRET_ACCESS_KEY` secrets and `AWS_REGION` variable. Only **after confirming credentials, least privilege, and a safe retention rule** set `BACKUPS_ENABLED=true`. Verify the `Encrypted recovery backup` workflow **completes successfully**; the latest observed scheduled run was **skipped**.
3. Restore the encrypted archive to isolated, non-production PostgreSQL and object storage. Check original source files, permissions, row counts, login and course histories and documented `backup:drill` behavior. Store timestamped evidence outside GitHub. Do not equate test fixtures, Neon branches, or a green configuration check with a real offsite backup.
4. For the public Render service, confirm the correct workspace, deployed commit SHA, manual deployment settings, HTTPS/DB readiness and WebSocket joins. `render.yaml` has `autoDeployTrigger: 'off'`; do not infer a new GitHub push was published. Run `npm run smoke` against the real URL only after explicit workspace confirmation.

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
