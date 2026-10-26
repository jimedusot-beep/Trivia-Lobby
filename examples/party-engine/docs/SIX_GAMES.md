# Six family games — combined guest pack

These six modes are integrated in the combined PR #59 alongside five social modes from PR #57 and existing three original party modes (14 total). The public **Pick a Game** catalog gives each mode readable rules, its 3–20 player limit and a Host action. Every mode uses the same local, no-tracking QR invitation, six-character room code, host/player credentialed WebSocket transport, bounded room size, authoritative scoring, and reconnect protection. Changes only go live after verified merge **and** a separate Render deploy. All content packs in this PR are original.

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
- Existing classic guest Quiz/Prompt Duel/Charades and all five social modes are included in one integrated release; PR #57 is superseded after acceptance. The authenticated deck/study system is not accessed by the guest game code.
- QR generation comes from the main-branch shared invitation widget (#58). The pack does not create a second QR endpoint.
- Browser local drafts are only convenience. Live server validation is authoritative. Underlying guest runtime remains single-process/in-memory.

## Review gates

- [ ] `cd examples/party-engine && npm test` including original and new scoring/privacy tests.
- [ ] `npm run test:browser` including six new browser scenarios and the original five social games.
- [ ] Root `npm run check`, unit test, production build, WebSocket load, native Postgres, and Chromium/Firefox/WebKit acceptance.
- [ ] Reconcile #57 against #59: confirm all five social games are present in #59; close the superseded PR only after merging this pack.
- [ ] Independent approved review of the combined PR; **no merge on green CI alone**.
- [ ] Network integration checks for each of the 11 new modes at **both 10 and 20 WebSocket participants**, including session recovery, timely reveal, next round and score bounds; browser tests across all 14 host menus verify QR invitation links and nickname reconnects. A physical 10–20-phone pilot is **still separate** and must not be claimed from simulated WebSocket clients. Deployment requires the owner-selected existing Render workspace.
