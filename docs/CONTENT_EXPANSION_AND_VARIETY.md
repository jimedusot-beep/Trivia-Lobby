# Original content expansion: quantity, variety, performance and provenance

**Branch:** feature/original-content-rotation-packs-20261031 (draft; not deployed).

## Motivation

The deployed game started with only five sample quiz questions, eight Prompt Duel entries, five prompts in several social games and small game-show pools. Players could finish a match but hear almost exactly the same content on the next one.

This work adds **original, checked-in, family-friendly** packs. It borrows architecture ideas (not third-party question text) from open-source trivia projects: self-contained packs, efficient rotation, duplicate checks and offline fallback. No runtime API keys, remote fetching, scraping, generated scoring decisions or browser-shared answer keys are required.

## Expansion, without longer matches

- **Trivia Quiz:** retain the existing five-question standard match. The content pool expands from five to over 100 independently checkable choices, including curated science/geography/general facts and mathematically calculated questions. Correct options, explanations and distractor uniqueness are checked by automated tests.
- **Prompt Duel:** eight original prompts plus 50 new prompts. Same one matchup per player, but rematches shift to a different segment.
- **Majority Rules, Who's Most Likely, Closest Wins, Survey Showdown and Secret Impostor:** each retains its existing five-round rules and player limits; each source pool gains 20–30 new entries.
- **Guess the Percentage, Category Clash, Caption Chaos and Timeline Tangle:** expanded original polls, dictionary-backed category challenges, story scenes and date-checked timelines, without changing the number of live rounds.
- **Family Bingo:** the word list increases from 24 to 64. Each match draws 20 calls; a player's 16-card words now come from that same chosen call set, so all squares can actually be called by the end. A line is still scored at most once per player.
- **Bracket Battle:** the selection pool increases from 16 to 48, while an individual game retains exactly 16 contestants / 15 votes.
- **Family Showdown:** five authored complete show packs (the original plus four new). Each includes three boards with house-ranked points adding to 100 and five lightning questions. **These are not actual survey statistics.** Imported custom shows remain unchanged.
- **Charades:** both existing action/animal categories increase from 16 to 32.
- **Doodle Dash:** new original drawable words supplement the existing 90-word pool.
- **Forbidden Word Frenzy:** retains 160 distinct built-in cards. It did not need an artificial expansion.

## Selection and scalability

The baseline (first game in a fresh room) remains backward compatible. **Each naturally completed game in that same party increments the championship counter; the next game selects the next fixed-size content slice.** That makes rematches different while guaranteeing that a five-round mode has no repeated pool entry inside those five rounds. Selections remain stable during active gameplay and on checkpoint recovery. The same rule applies to all supported social/bonus question packs; temporary private answer data stays server-side.

All banks load once with the Node module graph. Selecting an item is constant time; getting a five-question quiz allocates only five references. The game engine keeps its existing max 20 room participants, phase deadlines, score authority, and no-login QR experience. No database migrations or network dependencies are added.

**Known limitation:** a completely new room intentionally starts with the first curated group, so repeat avoidance applies to sequential matches inside one party, not across unrelated rooms, devices or seasons. The visible championship history keeps the latest 40 games, but a separate checkpointed completed-match counter continues content rotation past that cap; selection wraps after the authored pool is exhausted. A future opt-in "shuffle first pack" preference can be added with deterministic seeds and regression updates.

## References for approach, not content

- Open Trivia DB: session-token repeat avoidance; its question text is CC BY-SA, not imported.
- Trivium (MIT): customizable, cacheable question pipeline with validation.
- ThreeWill Feud (MIT): pack-defined boards and host adjudication; no board/question text copied.
- Avoid fan-site scraped Family Feud question collections and noncommercial-only datasets.

## Required release checks

Run Node test suite, current app checks, guest engine WebSocket tests, Chromium/Firefox/WebKit browser matrix, integrated database/recovery, and review host/phone screenshots. This draft must not modify production until all checks pass and a separate merge/deploy decision is made.
