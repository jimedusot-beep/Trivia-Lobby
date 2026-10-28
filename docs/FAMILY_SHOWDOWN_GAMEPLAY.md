# Family Showdown: phone controls and answer review

This is an original, casual team game. It uses the existing nickname-only room,
QR invitation, authoritative server, checkpoint storage and championship. No new
account, dependency, database migration or hosting resource is required. This
change is separate from the deployed drawing/poker release.

## Evidence and scope

Baseline: main commit `bcaa94fb2a6fad91c74a1b6cc371cefe5cd02cf1`.
The old phone renderer put both full team rosters and the entire answer board
before the buzzer. Browser measurement at 390 × 844 placed the buzzer's top at
1,213.64 pixels. The updated renderer at the narrower 320 × 844 placed it at
620.58 pixels, ending at 701.38 pixels. These are browser measurements, not tests
on physical phones. The screenshots were visually inspected locally.

The regular-round reducer previously accepted a buzzer and host judgment but no
player answer text. Lightning answers used normalized exact matching only, with
no opportunity to credit equivalent wording. The new flow addresses those gaps.
The repository's 30-game catalog does **not** include a Sorry-style pawn race;
the VirtualTabletop reference does not mean its full game collection is shipped.

Primary implementation evidence:

- [Original main reducer](https://github.com/jimedusot-beep/Trivia-Lobby/blob/bcaa94fb2a6fad91c74a1b6cc371cefe5cd02cf1/examples/party-engine/open-pack/feud.js)
  and [renderer](https://github.com/jimedusot-beep/Trivia-Lobby/blob/bcaa94fb2a6fad91c74a1b6cc371cefe5cd02cf1/examples/party-engine/public/pack-ui.js).
- Current `examples/party-engine/open-pack/feud.js`, `public/feud-ui.js`,
  `test/feud-guidance.test.js` and `browser-specs/open-pack.spec.js`.
- Existing functional reference: [Friendly Feud at the recorded revision](https://github.com/joshzcold/Friendly-Feud/tree/eae4b1bf7a55303b3b48c49788e0b87f4870ecef),
  recorded in [the provenance manifest](OPEN_GAME_SOURCES.json). That project is
  credited for architecture/game flow only. This revision adds original code;
  it does not copy a commercial show's questions, artwork, APIs or protocol.

## Observable match flow

1. The host opens Family Showdown. Guests enter nicknames and join the same room.
   Joining order alternates guests between Sunshine and Starlight. The host can
   rename teams. The public phone view identifies the guest's own team.
2. Each board starts with 45 seconds to buzz. Phone controls appear above compact
   team scores and a collapsible board. The host sees the board and separate,
   initially closed answer controls. No buzzer means an unawarded board reveal.
3. The first buzzer gets 20 seconds to answer. That player can speak to the host
   or type up to 60 readable characters. Only that player can submit at this step.
4. Normalized exact matches reveal automatically and add the listed value times
   the board multiplier to the pot. Normalization handles case, punctuation,
   spacing and Unicode compatibility; it does not invent semantic matches.
5. Other wording is held for up to 20 seconds for host review. Only the sender
   and host receive its text. Other guests see that a response is awaiting review.
   One pending response blocks further submissions. The host selects a canonical
   answer or marks a miss. Spoken answers still use these same host controls.
6. A correct buzzer answer wins control. A miss or timeout gives the other team
   control. The host can pass control immediately after the first correct answer,
   before another response or strike. Team members collaborate; there is no fixed
   individual answering order. Each subsequent answer gets 25 seconds.
7. Three misses open a single 20-second steal opportunity for the other team.
   Only that team may type an answer. A successful steal adds that answer's
   multiplied value and transfers the pot. A failed/timed-out steal leaves the
   pot with the controlling team. A payout message identifies the winning team.
8. The host chooses Next after each reveal. Original sample boards use ×1, ×2
   and ×3 multipliers. Custom shows retain their validated multipliers.
9. The leading team takes the lightning final; a score tie uses the first team.
   Its first two players take separate 20- and 25-second runs across five
   questions. A one-player team takes both runs, which the UI explicitly explains.
   Each timer covers the whole run. Pass/timeout fills unanswered slots with zero.
10. The second run cannot reuse the first run's normalized answer to a question.
    Rejected drafts remain in the form. Neither other guests nor the other
    finalist receive the first run's responses before the results are published.
11. Both runs lock before private host review. Exact matches are pre-scored;
    the host can map different wording to a listed answer or leave it at zero.
    Each canonical answer can score once per question across both runs. A passed
    or timed-out slot cannot earn points. Guests cannot judge or publish results.
12. Publishing reveals both runs and the total toward the 200-point goal.
    Next banks the total for the winning team's players and finishes the match.
    Repeated requests cannot award the final or a pot twice.

## Architecture and recovery

`feud.js` validates actors and bounded payloads, resolves canonical matches and
controls deadlines/payouts. Its projections add only team identity, permissions,
public feedback, and role-appropriate response fields. The client never supplies
a score. `public/feud-ui.js` owns responsive presentation and local form drafts;
`pack-ui.js` delegates without changing other games. Server snapshots preserve
pending answers, both final runs, canonical matches and the private review stage.

New matches carry a `guided` marker. Older restored matches keep their existing
spoken-answer flow and direct final reveal; the UI explains that a new match is
needed for the new behavior. Existing private-account/document authorization and
room credentials are unchanged. Host answer keys remain on the host connection.
An opened panel is visible to anyone viewing or casting that screen: a collapsed
panel is not a separate secure TV presentation channel, and the UI says so.

## Acceptance and validation

- Ten focused engine tests cover actor ownership, exact matches, pending-answer
  privacy/locking, host judgment, rejected-action atomicity, passing, steals,
  silent/timed-out rounds, one-time payouts, private final review, canonical
  duplicate protection, whole-run clocks, checkpoint restore and legacy matches.
- Existing 10- and 20-guest WebSocket fixtures now send an alternate-wording
  answer, verify host-only text delivery, judge it, and auto-match a second answer.
- Two browser journeys cover a 320px first-screen buzzer, hidden opponent wording,
  typed answers, three strikes, steal, reload, all boards, retained duplicate draft,
  final review, host reload, publication and final scoring.
- The full 18-journey local Chromium game-pack suite passed, including drawing,
  poker, other boards, custom shows, imports, credits and the 30-game catalog.
- All 221 guest-engine/network tests and 110 app tests passed locally. TypeScript
  and production build passed. Axe scans found zero violations on the 320px
  buzzer view and the desktop private host review view.

Final GitHub CI/browser results belong in the PR, with run links. Local Chromium
and automated accessibility checks do not establish physical-phone, Safari,
screen-reader, free-tier capacity or Wi-Fi latency guarantees. No production
deployment is performed by this branch.

## Remaining limitations

These house rules use one buzzer answer, rather than a television-style ranked
two-contestant faceoff. Team members collaborate rather than rotate through
enforced individual turns. Team assignment follows joining order. The host is
trusted to judge equivalent wording and must operate private controls on a screen
that is not exposed to players. There is no separate read-only TV/spectator role.
The original sample pack remains three boards and five final questions; custom
validated shows supply more content. Sorry-style gameplay is a separate feature.
