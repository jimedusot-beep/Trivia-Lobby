# Odd One Out — multiplayer dinner game

## Play the built-in pack

1. Sign in to Trivia Lobby.
2. From Home select **Odd One Out · 20 Questions**. The server atomically imports an owned, editable copy of **Extreme Edition** into your account and opens the host lobby. Repeating the action reuses the existing import.
3. The lobby auto-selects **Odd One Out**. Set question count (1–500, capped to your deck size), timer (15/30/45/60/90 seconds), and optionally shuffle questions or answer positions. Default is 20 rounds and 45 seconds.
4. Share the existing QR link or six-character room code. Guests join using /join on their phones; no guest registration is required.
5. Press **Start Game**. Players each select one of four choices and may write up to 200 characters describing the hidden connection *before* locking the choice.
6. At reveal, the host sees the correct answer, its explanation, and the players' proposed explanations. The host grants at most one +1 bonus per correct selection that supplied an explanation.
7. Host clicks **Finish bonus review**, then **Show leaderboard** and **Next / Finish**. Repeat until all rounds are complete.

## Scoring

- Correct impostor: **1 point**.
- Wrong or missed answer: **0 points**.
- Host-approved explanation: **1 extra point**, only following a correct choice.
- 20-question pack maximum: **40 points**.
- Workshop currency, classic streak multipliers, party multipliers, and wagers are not applied.

The server remains authoritative. Players never send their own award amounts. Host-only approval and finalization are validated by room identity, WebSocket ownership, state, question index, and a one-time-per-answer guard.

## Answer confidentiality

The built-in starter pack's correct choices and explanations are stored in `server/odd-one-out-pack.ts`, not browser JavaScript. The authenticated `POST /api/odd-one-out/starter` creates an owned deck through the existing storage import receipt transaction and returns only the new deck ID. During a live round, the WebSocket public-question projection does not include the answer key or explanation; the host sees proposed player explanations only after reveal.

**Scope:** The GitHub repository itself is public, so anyone who deliberately inspects repository source can still see the bundled pack data. For high-stakes competitions, author a new private deck rather than using the public starter pack.

## Custom question decks

Create a normal private deck with *exactly four* multiple-choice options and exactly one marked correct. Place a substantive explanation of why three belong together in the answer/back field. Choose `Odd One Out` on the host's game mode selector.

The game rejects a deck if any live-playable question lacks four choices or a nonempty explanation, instead of silently grading it like a standard quiz. Use an all-Odd-One-Out deck; keep ordinary classroom quiz questions separate.

The new mode reuses the existing host, guest, storage, report, and WebSocket infrastructure. All scores are isolated from learning mastery and memory schedules.

## Operations

- Uses the existing Render web process, Neon PostgreSQL and private account routes. Do not provision a second service or database.
- No new migration is necessary for the starter pack or round scoring. Reports store player explanation and explanation bonus in the per-player response JSON, and finalize Odd One Out rounds after host review.
- Rooms are process-local: Render Free restarts or sleep can interrupt an active match. A draft pull request does **not** deploy the feature.
- Test with `npm run check`, `npm test`, `npm run build`, and `npm run test:e2e` in a correctly configured local or CI environment. The Odd One Out browser test uses a dedicated app process and disposable database.
- This version relies on a human host for explanation judgement; no model/API key is needed.

## Future improvements

Potential later upgrades: automatic category-specific question suggestions subject to fact review, presenter themes, local-language variants, audience voting for explanations, and a history-aware difficulty system. These are not needed for the first playable release.
