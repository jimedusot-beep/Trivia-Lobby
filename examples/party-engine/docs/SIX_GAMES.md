# Six selected family games — staged integration

This feature is based on the still-open PR #57. It is not on `main` and it is not deployed. All six additions reuse `/party/`, the public 6-character join code, existing QR invite, host/player credentialed WebSocket transport, 3–20 connected players, server-owned score totals and reconnect protection. All content packs in this PR are original.

| Game | Rounds | Player action | Scoring | Fairness |
| --- | ---: | --- | --- | --- |
| **Bracket Battle** | 15 matchups (16 entrants) | Vote on two contenders | +100 for picking advancing choice | At a vote tie, first contender advances (explicit tie rule); winners feed the next bracket |
| **Timeline Tangle** | 5 | Put 4 events in chronological order | +25 per correct position (max 100) | Four distinct indices, server-owned dates, shuffled display |
| **Caption Chaos** | 4 | Write an 80-character caption, then vote | +100 per received valid vote | Anonymous captions during voting, cannot vote for own entry |
| **Category Clash** | 5 | Enter a word in the requested category/letter | +100 for unique accepted answer; +50 for repeated | Starter-pack dictionary defines accepted responses, not all theoretically valid words |
| **Guess the Percentage** | 5 | Vote Yes/No, then estimate the percentage Yes | max(0,100 - 2×percentage error) | Individual poll answers, poll total and actual percent withheld until reveal |
| **Family Bingo** | 20 calls | Mark only the currently drawn word on your private 4×4 card | +100 once for first complete row, column or diagonal | Cards randomized server-side; no remote client-supplied winning card or mark |

**Notes:** Bracket selection is deliberately a *family preference tournament*, not a trivia correctness contest. Timeline starter examples are dated historical facts that should be editorially checked periodically. In Category Clash, plausible but unlisted answers score zero; communicate the curated starter-pack limitation to players. Caption Chaos is user-generated content and a host needs to supervise it. Bingo requires a fresh call per host-driven reveal; participants may have a round with no matching card cell. Free-tier restarts clear all active games.

## Security and isolation

- Public projections whitelist mode-specific fields. Pre-reveal bracket votes, date keys, accepted dictionary, individual poll votes, caption authors and each other person's Bingo card are not serialized.
- The sole writable message for the new games is the existing `respond` action. Socket session identity, request ID deduplication, match revision, deadlines, room membership, input bounds and one-time scoring remain enforced server-side.
- `Bonus` state is isolated per room; Bingo cards and bracket progression persist only during a match, resetting when the same room starts a new match.
- Existing classic guest Quiz/Prompt Duel/Charades and the five PR #57 modes should continue unchanged. The authenticated deck/study system is not accessed by the guest game code.
- Private invitation QR generation is part of PR #57; this stacked PR reuses it and does not create another QR service.
- Browser local drafts are only convenience. Live server validation is authoritative. Underlying guest runtime remains single-process/in-memory.

## Review gates

- [ ] `cd examples/party-engine && npm test` including original and new scoring/privacy tests.
- [ ] `npm run test:browser` including six new browser scenarios and the original five social games.
- [ ] Root `npm run check`, unit test, production build, WebSocket load, native Postgres, and Chromium/Firefox/WebKit acceptance.
- [ ] Ensure PR #57 is reviewed/approved and integrated first, then rebase this stack on the landed code.
- [ ] Independent approved review of the combined PR; **no merge on green CI alone**.
- [ ] Real group pilot with 10–20 devices, host and phone reconnect, long-text and failure cases; release/deploy separately.
