# Guest courses from personal quizzes

## Problem and decision

After saving a no-account quiz, a learner needs a short next lesson and a way to
return tomorrow. Implement one original guest course flow over the existing
browser-local quiz records. The evidence is `guest-decks.js`, `practice.js`,
`GuestLearn.tsx`, their browser tests and the existing bounded design research in
`research/REA_DUOLINGO_LEARNING.md`. No competitor code, assets or new dependencies
are needed. This feature does not change private library APIs or server grading.

## Acceptance contract

- `/party/learn.html` lists quizzes already saved on this device. Each quiz is a
  course, divided in order into lessons of up to five questions. Finish an earlier
  lesson to unlock the next; completed lessons remain replayable. Empty and missing
  quizzes link to the creator rather than an account screen.
- An answer is accepted once. Show the correct answer and supplied explanation,
  then offer Continue. Each first-pass miss returns once at the end. The summary
  separates first-pass accuracy and retry results; completing is not called mastery.
- Save the current prompt/feedback so refresh can resume. Content changes create a
  new course version and explain why its current path starts fresh; historical XP
  and achievements remain. Abandoned lessons award no XP.
- Award 5 completion XP plus 10 per first-pass correct answer on the first
  completion of a versioned lesson. Replays award no more XP but can improve the
  displayed best score. Each 100 XP adds a level. XP is local practice feedback.
- One completed lesson meets the daily goal. A daily action chooses the next
  unfinished lesson, or rotates completed lessons once a course is finished.
  Replays can count toward the daily goal. Consecutive days use the saved IANA
  timezone and preserve best streak and earned milestones after a break.
- Local progress mutations read and update in one IndexedDB transaction so two
  tabs cannot award the same lesson twice or overwrite each other's completions.
  If saving fails, practice stays usable with a visible session-only warning.
  Corrupt saved records are not silently replaced.
- A bounded JSON backup includes local quizzes and progress. Validate the entire
  import before writes, merge progress without erasing existing achievements, and
  refuse to overwrite a different quiz with the same ID. Quiz restoration and
  progress restoration use separate databases; a progress-save failure must say
  whether quizzes were already restored. Existing quiz JSON imports still work.
- All actions have visible labels, keyboard focus and text progress. Quiz text is
  rendered as text, never HTML. Provide phone layouts and reduced-motion behavior.

## Limits

No account, sync, notifications, server leaderboard, FSRS changes, generated
questions, alternate question types or proprietary content. Learning backups are
plain JSON. Device-local progress can be edited or cleared and is not proof of
knowledge. Limits: 30 quizzes, 20 questions per quiz, 600 versioned lesson results
and 3,660 activity dates. No new database migration or server payload is required.

## Verification

Record executed commands and results in the PR. Required: type check, root unit
suite, production build, guest engine tests, affected browser flows, reload and
backup tests, malformed data, version changes, concurrent completions and calendar
fixtures including DST. Merge, deployment and live-site verification are separate.
