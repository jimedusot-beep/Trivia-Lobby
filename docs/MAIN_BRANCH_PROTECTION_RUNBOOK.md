# Main branch protection hardening — Issue #49

Audit date: 2026-11-01. Repository: [Trivia Lobby](https://github.com/jimedusot-beep/Trivia-Lobby). Baseline source/main SHA: `1841025f8e5be153350e4cb44ad772a417448bab`.

**This changes documentation and adds read-only audits. It does not alter GitHub repository settings.** The connected GitHub plugin has no branch-ruleset administration action. An owner with repo Settings permissions must make any actual ruleset edits.

## Verified existing ruleset

Read from GitHub REST `/repos/jimedusot-beep/Trivia-Lobby/rulesets/26269964`: **Protect Trivia Lobby main**, active, default-branch target. GitHub `branches/main` reports `protected: true`.

Already configured:
- Branch deletion restricted and non-fast-forward/force pushes blocked.
- Pull request required for merges.
- Integrated required status contexts: `production-runtime`, `postgres-and-browsers (chromium)`, `postgres-and-browsers (firefox)`, `postgres-and-browsers (webkit)`.
- Those exact contexts, plus `checks` and the `guest-browsers` jobs, appear on main's successful GitHub Actions check run data.

Still incomplete:
- `checks` (the actual CI job: install, TypeScript, tests, build, npm audit) is **not a required context**.
- `guest-browsers (chromium)`, `guest-browsers (firefox)`, `guest-browsers (webkit)` are also not enforced. All three run on each PR and protect the separate 31-game party-engine surface.
- `strict_required_status_checks_policy` is `false`: an outdated PR is not necessarily retested against new `main` before merge.
- PR rule requires `0` approving reviews; `dismiss_stale_reviews_on_push` is `false`. Adding one independent approval may require inviting another eligible collaborator.
- The existence of an active rule does not prove all bypass permissions are limited; that requires owner-side settings review and an unprivileged policy test.

## Proposed owner-only settings changes

1. Open [Settings → Rules → Rulesets](https://github.com/jimedusot-beep/Trivia-Lobby/settings/rules), select **Protect Trivia Lobby main**. **Edit the existing rule**; do not create a competing duplicate.
2. Keep current active enforcement, default-branch targeting, pull-request requirement, deletion restriction, no force pushes and the four existing required integration checks.
3. In **Require status checks to pass**, include these exact additional job names (choose GitHub Actions as provider):
   - `checks`
   - `guest-browsers (chromium)`
   - `guest-browsers (firefox)`
   - `guest-browsers (webkit)`

   This produces eight required contexts total, encompassing core CI, integrated runtime/DB/browser checks and the separate public party-engine browsers. Check availability and exact names in the ruleset UI before saving, since non-existent or intermittently untriggered contexts can block all merging.
4. Enable **Require branches to be up to date before merging**. Merges of independently green but outdated PRs will then require a new integration recheck. Re-run CI whenever base `main` changes.
5. Where an independent reviewer actually exists and GitHub permits it, set **Require at least 1 approving review**, **Dismiss stale pull request approvals when new commits are pushed**, and consider requiring review of the last push. The repository's owner cannot substitute a self-approval. If there is no eligible second reviewer, **do not fabricate approval or accidentally lock yourself out**: document the owner-only exception (0 approvals), retain mandatory tests, and revisit this control when a collaborator is available.
6. Inspect bypass permissions and required signed commits/deployment choices according to actual repo governance. Do not grant broad routine bypass and do not turn off existing checks simply to get a green merge.
7. Save and confirm `main.protected=true`, active ruleset policy and the correct exact check contexts by reading GitHub settings/API.

## Evidence-backed verification

- The new manual [Main branch policy audit workflow](../.github/workflows/main-branch-policy-audit.yml) has an ordinary PR fixture-test job and a **workflow_dispatch-only** live-read job. After its PR merges, use **Actions → Main branch policy audit → Run workflow**; by default it expects one independent approval, or explicitly select `0` for an owner-only documented exception. Its report lists missing settings without ever modifying rules. A failing report is truthful, not a justification to weaken an unrelated workflow.
- Use a disposable unprivileged test collaborator/PR to prove: direct push and force push are denied; a failing core check or guest-browser check blocks merging; an outdated PR cannot merge until fresh combined CI; a clean reviewed PR merges. Do **not** test force push by overwriting `main` history.
- Check that Render autoDeploy remains disabled until backup [#48](https://github.com/jimedusot-beep/Trivia-Lobby/issues/48) and device release gates are complete. GitHub rules do not replace data backups or live smoke testing.
- Avoid requiring ephemeral or PR-only checks that don't always run. All eight proposed contexts currently run for `pull_request` targeting main.

## Limits and follow-up

This PR does **not** itself make `checks`, guest browsers, strict status or approvals mandatory; only a GitHub Settings edit can do that. It does not change gameplay, authentication, CI gates or Render. Keep Issue #49 open until real policy enforcement is verified and the owner-only reviewer exception (if any) is documented.
