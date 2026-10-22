# Learning-memory integrity follow-up

This patch addresses two discrepancies found during the repository-wide audit.

## Corrected questions no longer inherit mastery

- Editing a legacy flashcard's prompt, answer, type, options, or correct choice invalidates its **current** FSRS schedule. Unchanged saves and reordering do not reset mastery.
- Editing a universal question's validated definition invalidates its **current** question schedule when the definition materially changes.
- Existing review/attempt **history is preserved**. No attempt records are deleted by these edits.
- A visual answer submission against a stale question definition is rejected with HTTP 409 and a reload instruction, so it cannot schedule a review for a definition that is no longer current.
- Card review submissions acquire the card's database row lock, so a completed edit cannot retain an older in-flight review's schedule.

## Visual questions in the wrong-answer notebook

- The API now returns `visualWrongAnswers` from the owned `question_schedule` alongside the existing `wrongAnswers` for flashcards.
- It verifies both the schedule owner and the deck owner before returning the prompt. It intentionally does not return answer keys.
- The Learning page combines the two categories, distinguishes their types, retains subject filtering, and links visual misses to adaptive visual practice.
- Each list has a 5,000-item cap with a `notebookLimited` indicator; history events retain their existing limit.

## Verification

The existing native-PostgreSQL integrated test now verifies account isolation, visual notebook entries, unchanged/edit-induced mastery behavior, historical event preservation, and stale-grading rejection. GitHub's normal CI and browser/database workflows will run on the PR.

## Remaining limits

This patch does **not** implement durable historical snapshots or soft deletion: deleting a deck, card, or visual question still cascades into history, and older history rows display the current prompt rather than its original wording. A separate migration will be required to preserve deleted-question history and immutable historical wording while maintaining owner-only access. The visual retry button opens that deck's adaptive visual exam, which prioritizes weak items but is not an isolated single-question drill.
