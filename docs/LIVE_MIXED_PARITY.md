# Trivia Lobby mixed-format live quiz integration

This branch is an original, additive implementation of the existing question-bank architecture. It does not copy other quiz platforms' private code or assets.

## Implemented in this change

- Four live question kinds: legacy/universal single choice (2–4 options), true/false, multiple select (2–8 options) and ordering (2–8 items).
- Strict versioned protocol accepts original single-letter answers and typed `{value}`, `{selectedIds}` and `{orderIds}` responses.
- The server stores complete universal definitions privately; `QUESTION_START` and `SYNC_SNAPSHOT` contain only public question fields (option text and IDs, not answer keys or explanations). Only `ANSWER_RESULT` after reveal includes correct answers.
- Ordering choices are shuffled by the server once per question; reconnect snapshots reuse that exact public shuffle.
- The universal answer grader is reused for typed responses; unknown or duplicate option IDs, incorrect types, repeated answers and late answers are rejected.
- Editor exposes supported new kinds and stores 5–120 second question timers and standard/double points. Legacy cards continue using the server default.
- Direct invitation links of the form `/join?code=ABC234` prefill a syntactically valid PIN and contain no session/reconnect secrets.

## Verification / limits

- Run `npm run check`, `npm test`, `npm run build`, `npm run test:integration`, and `npm run test:e2e`. Hosted CI results are authoritative; do not claim passing until confirmed.
- Database schemas are unchanged: live settings are optional fields within validated universal JSON definitions.
- Current browser coverage for all new interactions should be expanded before promotion to production; the new real-socket test demonstrates five participants, all four kinds, per-question timing, invalid IDs, and reveal-only answers.
- This PR does not implement assignment persistence, gameplay reports, QR image generation, poll/word cloud semantics, media-only live questions, a public quiz marketplace, collaboration, AI provider rollout or multi-replica room authority. These must remain separate independently testable workstreams.
- Process-local rooms cannot survive application restart. Actual production storage, backups, monitoring and HTTPS configuration remain deployment responsibilities.
