# Private live-game reports — initial implementation

This change builds on the mixed-format engine in PR #27. It uses the same authorized account and original server-authoritative score decisions.

## Design

- A session row is created **before** an authenticated host receives its new room code. A database failure prevents creating a room with falsely promised reporting.
- Each revealed round is written immutably, using a unique `(session_id,question_index)` key. Replayed completion requests cannot overwrite an original round.
- The in-memory room chains report writes to preserve round order. The server finalizes the session after the last round write and before broadcasting `GAME_OVER`.
- Reports are owner-private. Lists, details, CSV export and deletion are all guarded by the authenticated account's ID.
- Guest nicknames and submitted answers are personal data. Report rows are removed when a host deletes the report or the account is deleted. There is **no automated retention expiry yet**; hosts should delete obsolete reports. Never put reconnect tokens, passwords or session cookies in the database report.
- CSV cells neutralize formula prefixes before quotes and escaping. Export is served as an attachment.
- Deleting a source deck retains its historical session and question snapshots. No migration of pre-existing live games is possible because those were never persisted.

## Known limitations

- This is durable **completed-round reporting**, not durable room authority: a process crash ends a live match, and an unanswered active round may not have a row yet.
- A report with no `finished_at` is interrupted/in progress, not falsely marked complete. Some rounds might be missing after a DB outage; a visible host error is emitted and completion isn't recorded when a write fails.
- Round records include every rostered player at reveal, with null response/response time for missing answers.
- No publication or aggregate analytics marketplace, teacher cohorts, long-term growth dashboards, assignment results, or team collaboration in this PR.
- Schema migration `0007_live_game_reports.sql` is additive and repeatable. Before production deployment, rehearse it on a staging database and take a verified backup. Pending PR #26 adds `0006_persistent_learning_history.sql`; when integrating these branches, keep the migration order 0005 → 0006 (if merged) → 0007.
- Reports require actual PostgreSQL persistence and protected deployment infrastructure. Test success is not evidence of a live production URL.

## Acceptance checks

- `npm run check`
- `npm test`
- `npm run test:integration` (PostgreSQL + dedicated disposable DB)
- `npm run build`
- `npm run test:e2e`
- `npm run backup:drill`

Never merge into production without the full migration and backup release gate.
