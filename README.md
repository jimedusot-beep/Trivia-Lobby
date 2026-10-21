# Trivia Lobby 🎮📚

**One app for family game night and college study.** Trivia Lobby combines live multiplayer quiz battles, reusable flashcards, and an evolving personal study library. Inspired by the *types* of learning experiences offered by Kahoot, Duolingo, and Quizlet; not affiliated with them.

## Repositories consolidated

This is the **single active codebase**: [jimedusot-beep/Trivia-Lobby](https://github.com/jimedusot-beep/Trivia-Lobby). [Trivia-lobb](https://github.com/jimedusot-beep/Trivia-lobb) was an empty duplicate, and now points here. Nothing needed to be copied from it.

## Already in the app

- Flashcard decks and study view
- Host/join live trivia games with WebSockets
- Database-backed decks and cards with PostgreSQL
- CSV paste import with preview
- New: select a local CSV or TSV file, preview, then import deck and cards in **one database transaction**

## Getting started

Requires Node.js and a persistent PostgreSQL database.

```bash
npm ci
export DATABASE_URL='postgresql://...'
npm run db:push
npm run dev
```

The `DATABASE_URL` must point at a **persistent** PostgreSQL instance. Never commit credentials. Use a deployment platform that supports a long-running Node server and WebSockets.

## Import file format

Create a UTF-8 `.csv` or `.tsv` file with header names as below, then select it on **Create Deck** and preview before saving.

```csv
Front,Back,Type,OptionA,OptionB,OptionC,OptionD,CorrectOption
"What planet is called the Red Planet?","Mars","multiple_choice","Earth","Mars","Jupiter","Venus","B"
"What does DNA stand for?","Deoxyribonucleic acid","flashcard",,,,,
```

Imported deck/card records persist **only as long as the connected PostgreSQL database is retained**. The original source file is not yet stored; keep your own source copy for now. The current application does not support users, private deck access, or permanent document storage.

## Product direction

1. **Study library:** permanent original PDF/DOCX/PPTX/TXT/CSV uploads, private accounts, folders, searchable notes, and source-linked cards.
2. **Study loop:** spaced repetition, self-tests, streaks, daily practice, and progress by course.
3. **Game night:** host/join rooms, timed questions, scoreboards, teams, friend/family packs, and accessible mobile play.
4. **Content creation:** bulk importing, document-to-card suggestions with human review, editing, duplicates, and exports.
5. **Reliability:** backups, private files, restoration tests, import limits, audit logs, and clear retention policy.

See [Import & storage plan](docs/IMPORT_AND_STORAGE.md) for security, data retention, and hosting considerations.

## Deployment note

The current Express/WebSocket server is **not** a drop-in static Netlify deploy. A static frontend on Netlify would also need a separate long-running backend, PostgreSQL, a documented WebSocket URL, and correct cross-origin routing; alternatively deploy the full app on a Node host supporting WebSockets. Do not assume Netlify alone will keep rooms and files alive.
