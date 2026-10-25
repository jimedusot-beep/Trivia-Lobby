# Contributing to Trivia Lobby

## Deliver one feature at a time

REA research is part of development: **investigate one feature → specify it → implement an original version → test it → move to the next feature**. Success means a verified improvement to the game, not a growing list of references.

This workflow applies to human and automated contributions. Inspect current main and relevant open PRs first; preserve existing work and verify current behavior rather than relying on historical phase reports.

1. **Select one feature.** State the player or host problem, the smallest useful end-to-end improvement, and explicit non-goals. Fix blocking reliability or security defects before expanding that feature. Keep unrelated ideas in the backlog.
2. **Investigate only the decision at hand.** Start with existing code, tests and research notes. When external research is needed, default to a 30-minute timebox and at most three directly relevant references; there is no minimum source count. Record the exact source URL, commit/version, files or documented behavior examined, license status, useful pattern and relevant limitation. Separate observations from untested claims. Do not expand the platform catalog as a prerequisite.
3. **Write a small specification.** Before coding, put the intended behavior, acceptance checks, relevant permissions/data/message changes, failure cases and non-goals in the issue or PR. Choose an approach when enough evidence exists to implement and test it. If a concrete blocker remains, record the unanswered question and a bounded next investigation; do not silently extend research.
4. **Implement an original version.** Fit the existing React/Express/PostgreSQL architecture and preserve working behavior. Adapt functional ideas through independently written code and original game presentation. Any intentional dependency or code reuse requires a verified license at the exact version, required notices and an updated license inventory when applicable. Never copy proprietary branding, assets or question banks.
5. **Test the promised behavior.** Run checks appropriate to the change and record exact commands and actual outcomes. For runtime changes, run `npm run check`, relevant automated tests and `npm run build`; include the affected browser/game flow. Exercise permissions, reconnects, persistence, migrations or malformed inputs when touched. Documentation-only changes need link/content/diff checks rather than a full runtime suite. Mark unrun checks and environmental blockers explicitly; do not present an untested feature as complete.
6. **Finish before expanding.** Resolve failures affecting acceptance, submit the focused change with evidence, and complete review/integration before starting the next feature. If blocked, record the incomplete state and unblock action before explicitly re-prioritizing. Merge, deployment and production verification are separate states: report only what actually happened.

## Research stopping rule

Stop when a pattern has been selected, its relevant limitations and licensing are understood, and the acceptance checks can be written. Further investigation must answer a specific unresolved implementation question. Simple repairs with sufficient local evidence need no external research.

The [research catalog](docs/LEARNING_PLATFORM_RESEARCH.md) is a historical source of leads, not a requirement to inspect every repository or deliver every listed idea. Check current code and verification evidence for feature status. Keep new findings in the feature's issue or PR; add a reusable catalog note only when it supports a concrete implementation.

## Compact feature record

Use the PR template to keep the record with the change:

- **Problem and scope:** one user outcome, non-goals.
- **Evidence and decision:** local code/tests; external sources only if needed; selected pattern and limitations.
- **Specification:** observable acceptance checks, failure cases, affected contracts.
- **Implementation:** original behavior delivered and relevant reuse/attribution.
- **Verification:** commands, outcomes, manual/browser evidence and remaining blockers.
- **Delivery:** review/merge status; deployment and production verification if performed.

Do not invent evidence or mark proposed behavior as implemented. A failed or unavailable required check remains a visible blocker, not a reason to broaden research.
