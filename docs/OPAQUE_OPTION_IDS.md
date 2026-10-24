# Guest option-ID confidentiality

## Threat and mitigation

The app already withholds explicit answer keys during live play and before submission of self-paced assignments. However, author-defined option IDs in a universal question could be semantic hints such as `first-correct`, `right-option` or `answer-is-dog`. Sending these exact IDs would leak answer clues even when `correctOptionIds` and `correctOrderIds` were absent.

The server now generates random UUIDs for choice and ordering items and rewrites **both the private correct-answer references and public option IDs together**:
- **Live game:** rekey a private in-room snapshot at room creation; rejoin and reconnect reuse the same snapshot, and server grading remains authoritative. Other rooms receive fresh independent IDs.
- **Self-paced assignment:** rekey the immutable published snapshot before storing it; public guests receive stable opaque IDs, and saved attempts are graded against those same private IDs after restart.
- The canonical owner-owned question bank is **unchanged**, so author editing, imports and study memory retain stable definitions.

New tests assert original IDs are absent from public payloads and that re-keyed grading remains correct across question types.

## Limits

This does not hide the *text of each choice*, which by design must be visible to the participant. No machine can prevent clue-bearing author-written wording. Live legacy single-choice uses the existing A/B/C/D answer transport for compatibility; it does not disclose the correct letter before reveal.

Existing published self-paced assignments created before deployment are not rewritten by this additive application change. Where such assignments contain semantic IDs, consider expiration/republication after release.

No new database migration is required. This change is pure server logic and is stacked on PR #31, #30, #29, #28 and #27.

Production acceptance still requires test green status, security review, HTTPS deployment, account authorization, database backup and release verification.
