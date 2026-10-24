# Persistent learning history — 2026-10-22

## Why this exists

Previously deleting a deck, card, or universal/visual question cascaded through its review and attempt rows. That discarded a learner's record despite persistent cross-device storage. This migration keeps **completed attempts** after a question or deck is removed, while still deleting active FSRS schedules and making removed content unavailable for future practice.

## Migration and backfill

The ordered additive SQL migration `0006_persistent_learning_history.sql`:

1. Creates review-time snapshot fields for original identifiers, deck identifiers, prompts, deck titles, and subjects.
2. Backfills existing attempts from the currently available cards/questions/decks (when already-edited historical wording is unavailable, no reconstruction is claimed).
3. Changes the event/attempt foreign keys from `ON DELETE CASCADE` to `ON DELETE SET NULL`, so deletions remove live references instead of history.
4. Retains `ON DELETE CASCADE` for the owning user account; deleting a user still deletes their personal records. Live `study_schedule` and `question_schedule` also continue to cascade on removed study materials.
5. Uses conditional constraint migration and `IF NOT EXISTS` so repeated startup migrations avoid unnecessary FK recreation.

This migration runs automatically through the existing `npm run db:migrate` and the built production launcher, following `0005_integrated_platform.sql`. **Back up your production database and original documents, rehearse against an isolated copy, and verify all migration checks before deployment.** No production database was changed by this pull request.

## Review recording and readback

- Legacy reviews snapshot the card prompt and deck metadata inside the same transaction as schedule and event creation. Event content cannot change when a teacher later edits a card.
- Universal/visual attempts snapshot the prompt and deck context when the server records the grade.
- `GET /api/study/history` returns active and archived card review rows (with archived flags), and a separate owner-scoped `visualHistory` array for visual exam attempts. Both histories are capped to 2,000 recent rows; the existing JSON export includes **all** rows.
- The personal Learning page has a **Preserved learning history** section containing retained results for deleted cards/decks. Deleted material no longer appears in the active due or wrong-answer queue.
- `GET /api/study/export` retains archived events and visual attempt rows including their original IDs and snapshots; the recovery archive backs up the entire database plus retained original files as before.
- History remains scoped to the signed-in account. It is not accessible to unrelated accounts or guest room participants.

## What remains

- Historical content before installation of this migration can only be backfilled from its currently saved version. Previous edits or previously deleted events cannot be recovered retroactively.
- If the owner deletes their account (in a future account-removal workflow), cascading personal-data deletion is deliberate.
- Archived review entries are evidence of an attempt, **not** recoverable active decks or their answer keys; restoration of questions requires the separate deck backup.
- This is not evidence that offsite production backups, a live database or a public deployment are configured. Those require independent operator verification.
- The dashboard's currently active deck totals exclude deleted materials; all saved attempts remain available through history and export.
