# Kahoot-style live hosting and participation

Research snapshot: **2026-10-25**. Trivia Lobby baseline: [`0341181653`](https://github.com/jimedusot-beep/Trivia-Lobby/tree/0341181653c00f0015b71339517bbc71d6530c2a).

Evidence labels: **DOC** = retrieved publisher documentation; **SRC** = inspected pinned source, not executed; **TEST** = command actually run; **DESIGN** = original proposed behavior, not a competitor claim. A file existing is not proof its feature works. None of the competitor applications were run, and no proprietary implementation was inspected. See [comparison and validation](REA_FEATURE_COMPARISON.md) for shared limits and [assignments](REA_IMPLEMENTATION_ASSIGNMENTS.md) for delivery contracts.

## Sources and observed behavior

**DOC K1:** [Kahoot join guide](https://support.kahoot.com/hc/en-us/articles/360039890713-Kahoot-join-How-to-join-a-Kahoot-game) documents PIN/link/QR entry and nickname selection; host settings can add identifiers or checks. **DOC K2:** [Kahoot content safety guide](https://trust.kahoot.com/safety-guide-for-content/) documents removing nicknames and locking games. These are documented interfaces, not sessions tested here. We do not infer their backend, scoring constants or reconnection guarantees.

**SRC K3–K5:** Pinned alternatives below establish host/player separation, explicit reveal controls and isolated game state. Open-kahoot's time-based formula is that project's implementation, not verified Kahoot behavior.

## Original behavior specification (DESIGN)

Journey: public landing → choose licensed built-in demo → choose classic/teams → host lobby with code/link/QR → player enters only nickname → host starts → question → answer acknowledged → reveal → leaderboard → next → final summary/rematch. Account owners retain their existing private-host flow.

| State | Allowed action and feedback | Failure/recovery |
| --- | --- | --- |
| Public catalog | Choose a versioned demo; explain public game vs private library | Missing demo returns recoverable catalog error; never fall back to a private deck ID |
| Lobby | Players see roster; host starts, removes player or locks admissions | Invalid/full/expired/locked room has specific message; nickname error retains code |
| Playing | Each player submits once; show sent/waiting state; host sees answered count | Deadline is authoritative; duplicate submission returns prior acknowledgment; stale question rejected |
| Reveal | Show correct answer, explanation and personal result after close | Reconnect returns the current sanitized projection, not a second score |
| Leaderboard | Stable ranking; ties share score and deterministic order | Host disconnected status; do not invent a new host from a nickname |
| Finished | Summary, exit, rematch with a new code | Server restart ends in-memory game honestly; no claim of durable live recovery |

## Proposed architecture

Extend `server/live-game.ts`, `shared/game-protocol.ts` and existing room projections. Keep server state `lobby → playing → reveal → leaderboard → finished`. Introduce a discriminated room content reference `{kind:"demo", demoId, version}` vs authenticated `{kind:"private", deckId}`. Resolve demo references only against an explicit immutable public catalog; never make storage.getDeck accept anonymous owner IDs. Anonymous host authority uses a random capability stored hashed server-side, rotates on resume, expires with the room, and is independent of display name/code. Reuse existing host-token mechanics after adding an explicit demo creation message; private `CREATE_ROOM` retains authorization.

Every submitted action binds room, participant credential, question index, operation ID and protocol version. Server captures deadline and score once. Client countdown derives from server time/deadline; delayed timers never extend acceptance. Player snapshots exclude answer keys, source passages, owner IDs and host credentials. Public demo answer keys need not be treated as secrets in distributed learning content, but live event projections must still avoid premature reveal. Display names are bounded text, not HTML; code lookup is rate limited. Target 100 players to match current room cap; no distributed-room redesign in this slice.

## Acceptance tests and performance requirements (DESIGN, unrun)

1. Clean browser with no cookie creates a demo room and a second browser joins with nickname only. An anonymous private-deck creation attempt still fails; demoId cannot coerce into a private deck lookup.
2. Fake clock: answer at deadline−1 ms accepted; at deadline rejected. All-answered and timeout racing create one reveal and one award per participant.
3. Disconnect during question; resume with valid token preserves answer and score. Forged/old rotated host token fails; nickname alone cannot resume.
4. Send start/next/reveal/kick as player; every operation is rejected without changing room state. Lock blocks new joins but allows credentialed resume.
5. Inspect all pre-reveal player frames: no solution, explanation or private source text. Two rooms using same demo have independent scores and timers.
6. Keyboard-only host/player journeys; explicit answer text and position labels, visible focus, no color-only answers; status announces sent, reveal and connection errors without reading every timer tick. Touch controls ≥44 CSS px. Test 320 px viewport and 200% zoom; screen-reader check remains manual.
7. Proposed load gate: 1 host + 100 simulated players on documented 2-vCPU/4-GB staging instance, 20 questions and 100-ms simulated RTT; p95 join acknowledgment <500 ms and answer acknowledgment <300 ms, 0 double awards or key leaks. Record p50/p95, errors and memory. These are targets, not measured results.

## Baseline comparison and limits

`server/live-game.ts` already validates roles, server deadlines, 100-player admission and credentialed reconnect. `server/routes.ts` authorizes hosting through account cookies. `client/src/App.tsx` leaves join/play public but guards home/host. Therefore guest participation exists in source, guest demo hosting is missing, and moderation/locking must be checked action-by-action before extending the protocol. Existing passing multiplayer unit tests do not prove real hosting capacity or accessibility. Assignments G0–G2 in the delivery plan own the guest slice and live regression gates.

## Pinned repository evidence

All listed projects are independently maintained references/alternatives; they are not official competitor source. Metadata and selected files were checked on the research date. “Not archived” is a GitHub flag, not a maintenance or quality guarantee.

### [soleilvermeil/open-kahoot](https://github.com/soleilvermeil/open-kahoot)

- Snapshot: `929c810b2c12e2dcbca666137a0e13ad02ca5116`; not archived; last push reported `2026-03-14T12:04:48Z`; fork flag `False`.
- License: **AGPL-3.0**. Root license files inspected: `LICENSE.md`. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`src/lib/game/QuestionManager.ts`](https://github.com/soleilvermeil/open-kahoot/blob/929c810b2c12e2dcbca666137a0e13ad02ca5116/src/lib/game/QuestionManager.ts). Question progression, option counts, personal results, connected-player completion, and a time-dependent score formula.
- Useful pattern and limitation: Next.js/TypeScript; separate question decisions from transport. The source includes dyslexia-related score adjustment; this is not proof of accessible runtime behavior.

### [ethanbrimhall/kahoot-clone-nodejs](https://github.com/ethanbrimhall/kahoot-clone-nodejs)

- Snapshot: `a2b4aba7c90f5222e3ed76ef7581c775c977d5e4`; not archived; last push reported `2022-12-08T04:26:50Z`; fork flag `False`.
- License: **none detected**. Root license files inspected: none found. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`server/utils/liveGames.js`](https://github.com/ethanbrimhall/kahoot-clone-nodejs/blob/a2b4aba7c90f5222e3ed76ef7581c775c977d5e4/server/utils/liveGames.js). LiveGames maintains separate games and looks up host-associated state.
- Useful pattern and limitation: Node/Socket.IO-era example; host/socket lookup is a design reference, not an identity or reconnect security model. Old dependencies; no runtime validation.

### [mawoka-myblock/ClassQuiz](https://github.com/mawoka-myblock/ClassQuiz)

- Snapshot: `49dca859dee1a1821b056abf95c2df501eda98e1`; not archived; last push reported `2026-10-24T11:24:27Z`; fork flag `False`.
- License: **MPL-2.0**. Root license files inspected: `LICENSE`, `Pipfile.lock.license`, `logo.png.license`. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`frontend/src/lib/play/admin/socket_game_controls.ts`](https://github.com/mawoka-myblock/ClassQuiz/blob/49dca859dee1a1821b056abf95c2df501eda98e1/frontend/src/lib/play/admin/socket_game_controls.ts). A wrapper emits start, question selection, solution display, final results and kick-player events.
- Useful pattern and limitation: Svelte client/Python service project; client control methods do not establish server authorization. The wrapper describes itself as still in development.
