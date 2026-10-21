# Security and multiplayer hardening — October 2026

## Implemented in repair branch

- Express library REST API requires a **family password sign-in** with a signed HttpOnly SameSite=Strict cookie. Production starts **only** when `TRIVIA_LIBRARY_PASSWORD` has 16+ characters and independent `TRIVIA_SESSION_SECRET` has 32+ characters.
- Session and logout endpoints. Guest join/play pages remain open; hosting and deck access require a library session.
- Login attempts are rate-limited **per running server instance**; HTTP mutating endpoints require matching `Origin`.
- Removed API response-body logs to avoid disclosing the stored question text and answers in logs.
- New WebSocket protocol: 6-character random room codes, server-issued player IDs and reconnect tokens, validated payloads, rate limits, room/player caps and timed rounds, server-authoritative scoring, duplicate-answer rejection and answer reveal.
- Leaderboard contains only public score fields; no raw WebSocket instances or reconnect tokens.
- Server enforces valid multiple-choice cards for live game hosting, clearing the previous potential stuck-host behavior; provides game errors instead of silently starting with unsuitable cards.
- JSON deck backup can be previewed without manually entering a title.
- Unit and multi-client WebSocket tests added to CI; research-manifest test included; production dependency audit blocks high/critical findings.

## Required production configuration

On your Node/Express/WebSocket hosting provider, set:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://...persistent-database...
TRIVIA_LIBRARY_PASSWORD=<minimum 16 character secure family password>
TRIVIA_SESSION_SECRET=<independent random secret at least 32 characters>
```

See [root .env.example](../../.env.example) for development. **Never commit these secrets.** Production boot fails without valid settings. Your hosting provider must support stable Node/WebSocket connections, a persistent PostgreSQL database and HTTPS. A static Netlify-only deployment remains unsupported. Use secure transport so browsers accept the Secure session cookie.

## Remaining essential work

This is **interim shared-family access**, not individual private accounts or a fully secure multi-user product:
1. Add named accounts and owner-scoped decks, courses, folders, roles and server-side authorization tests. Shared family-password holders can currently see and delete all study decks; do not upload private class or medical documents to a shared family library.
2. Add durable private object storage for the original PDF/DOCX/PPTX/TXT/CSV bytes, checksum and source metadata in PostgreSQL, quotas and authenticated downloads. Database rows contain cards, **not originals**.
3. Configure automated PostgreSQL + object-storage backups and regularly test restore; provide per-user export and deletion.
4. Validate all API inputs on server including question lengths, ensure full database constraints after checking existing orphan rows, add migration scripts.
5. Room state still lives in a single Node process; restart loses rooms. Distributed sessions require durable event transport and a shared session store.
6. Improve reconnect UI (the current client retries after disconnect but may need user-facing recovery), host/player mobile accessibility, browser end-to-end tests, sound controls, and visual exam support.
7. Add a production deploy smoke test with multiple real browsers and verify that the correct room protocol works under the target reverse proxy.
8. Review all npm advisories (including **dev-only** dependencies). Passing a production-only audit does not imply there are zero vulnerabilities.

## Operational constraints
- Do not expose unsigned WS host actions or legacy unauthenticated APIs on public deployment.
- Reusing copied third-party app source/images remains prohibited without an appropriate license; these fixes are original code.
- These changes are only a code-level security improvement and need deployment, penetration, and recovery testing before public use.
