# Uploads, persistent storage, and privacy

## Current status (verified in repository)

- Decks and cards are stored in PostgreSQL via Drizzle ORM, requiring `DATABASE_URL`.
- The importer validates **CSV/TSV tables and versioned Trivia Lobby JSON backups** into cards and saves them as a deck. Imports use a database transaction so a failure rolls back the whole deck.
- It does **not** retain the original uploaded file; file selection reads CSV/TSV/JSON on the browser, and the generated deck stores only parsed cards. Users can download a deck-card backup but not the original file.
- The app has no login/permission model: do not upload private class handouts, student data, or copyrighted course content you do not have rights to share on a publicly accessible deployment.
- Game rooms are kept in **server memory** and disappear if the server restarts.

## Durable uploads: next build phase

1. Add accounts, login, session security and per-user/per-family deck authorization before attaching private source documents.
2. Add server-side file validation, limits, scanning, and an upload flow that never embeds credentials in the browser.
3. Store **original files** in durable object storage (S3-compatible or equivalent), separate from GitHub and deployment filesystems. Record metadata in PostgreSQL: owner, content type, bytes, hash, object key, upload date, source license, import status, and linked deck.
4. Use short-lived signed upload/download URLs with server-side authorization; default all private course documents to private.
5. Parse documents asynchronously with job status and human review. Start with CSV/TSV/TXT, then PDF/DOCX/PPTX; preserve citations and page numbers. Require human confirmation of generated answers.
6. CSV and JSON *deck-card exports* and JSON restore are available in the study UI. Next: scheduled server-side backups and downloadable original source files after authenticated object storage is built.
7. Configure PostgreSQL point-in-time recovery, object versioning, lifecycle and backups. Verify restore drills and publish retention/deletion policies.

## Definition of 'saved permanently'

`saved` should mean the original bytes and generated material survive browser closing, app updates, server restarts, and deployments. **No system can promise literal forever retention**; enforce backup and recovery targets, account ownership, exports, and transparent deletion controls. Database rows alone are insufficient if the database is temporary or reset.

## Import quality checklist

- Preview rows, reject missing front/back and invalid multiple-choice answers.
- Avoid duplicate decks on retries; add an idempotency key before large imports.
- Report errors per file and per row without destroying prior saved work.
- Test empty file, UTF-8 BOM, quoted CSV, TSV, malformed columns, 2 MB limit, database rollback, unauthorized document access, and restore from backup.
- Do not auto-publish copyrighted or sensitive uploaded material.

## Hosting choices

Current app: Vite React frontend + Express HTTP API + Node `ws` WebSocket server + PostgreSQL. A traditional long-running Node host is the simplest full-stack deployment. Netlify can host static client assets only if the API and WebSocket service run elsewhere; configure endpoint origin paths accordingly. Original documents need durable object storage, not the Netlify build directory or a Git repository.
