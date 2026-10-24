# Self-paced assignment implementation and limits

## Guest and host workflows

An authenticated owner publishes an immutable snapshot of up to 100 supported questions (single choice, true/false, multiple select and ordering). The owner dashboard exposes a random UUID invitation URL and submitted scores; ownership is enforced server-side.

Guests need no account. A nickname creates a unique attempt with a random per-attempt secret (only a SHA-256 hash is saved in PostgreSQL). The browser keeps the secret locally to resume. Answers are saved to the server with `PUT /api/assignments/public/:id/attempt`, and immutable server-graded submission follows with `POST /submit`.

A shared assignment's public view strips accepted answers, correct choice IDs, answer explanations and source evidence. Its author-defined content is frozen at publication: subsequent deck edits do not silently replace assessment questions.

## Threat model and privacy

- The UUID invitation is effectively a bearer capability to discover the public assignment; don't share private or student-sensitive questions via guest assignments. **This does not provide a proctored examination.**
- Guest **nicknames are not verified identities**. The 1–3 per-nickname attempt limit is a convenience control, not protection against changing nicknames or browser/device.
- The secret is stored in localStorage and becomes invalid when the assignment is deleted; do not use this for sensitive/high-stakes exams on shared devices.
- Guest answers are accessible to hosts only through authenticated owner routes. Guests see only aggregate score and number correct after submission, not an answer key.
- The owner can delete an assignment and all guest attempt records. There is no automatic deletion/retention schedule; privacy policy/operations must address retention before public launch.
- Deadline and attempt limits are server-enforced. The current UI supports an optional closing date; the API also supports future opening dates.
- Draft changes require clicking **Save progress**; navigating away before saving loses unsaved on-screen selections. Retaking a complete assignment with the same nickname is prevented by the configured limit but may be bypassed using a different nickname.
- Preserve account-only study memory independently of guest assignment points.

## Release and migration

This is an additive migration `0008_self_paced_assignments.sql`, ordered after live reporting migration `0007`. Pending PR #26 may add historical-learning migration `0006`; merge all migrations in numbered order after a verified backup and rehearsal against a copy of the existing database.

Production acceptance still requires real HTTPS hosting, durable PostgreSQL, secret management, offsite recovery and human privacy/accessibility review. The room engine remains process-local; guest assignments persist independent of WebSocket process lifetime.

## Automated verification

Standard TypeScript/unit/build CI and native PostgreSQL integration (including unauthorized owner queries, wrong secret, duplicate attempt, saving, resume, idempotent submission and deletion) must pass. Browser E2E should prove the owner publication/guest complete flow in all three engines before production rollout.
