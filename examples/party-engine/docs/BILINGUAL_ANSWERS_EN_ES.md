# Bilingual typed-answer scoring — Survey Showdown and Category Clash

This is Phase 2 of the English/Spanish party work, stacked on the Phase 1 display branch (draft PR #131).

## What changes

- **Survey Showdown**: 5 fixed prompts, each with 5 ranked answers. Reviewed Spanish synonyms (for example `pasaporte` and `passport`) map to the same canonical *answer index*. The server applies the same 100/80/60/40/20 scoring; reveal counts combine both languages. Accents and casing are normalized. User submissions stay private until the reveal and are never machine-translated.
- **Category Clash**: accepted Spanish translations are limited to vetted equivalents of the fixed English starter words *that begin with the required letter*. The server converts exact accepted English/Spanish synonyms into a canonical answer key. `pineapple` and `piña` are one duplicate bucket, so they both earn 50 rather than two separate 100-point uniqueness awards.
- Spanish prompts, round/reveal text, and selected category examples are presented locally using the Phase 1 per-device language setting. English remains available on any other phone in the room.
- All action contracts, room-scoped scoring, player identities, elapsed times and reconnect behavior are unchanged.

## Limits / non-goals

- Do not use free-form machine translation to decide whether an answer is correct. Unknown words get no credit, as before.
- A Spanish word that does **not** start with the requested category letter is not accepted for that round, even if its English translation does. This first pass doesn't give every concept an equally natural translation.
- Alternate country-specific terms are not exhaustively covered. Review with Spanish-speaking players and expand only tested, clear, equivalent aliases.
- **Family Showdown** can use custom author-supplied answers and host-assisted judgment. It is *not* automatically translated or modified here. **Forbidden Word Frenzy** is a spoken game with a human referee and still needs a carefully translated clue/forbidden-word pack.
- Custom-created quizzes, player-submitted captions, nicknames, proprietary decks and other game packs remain unchanged.

## Tests required before merge

1. Run party-engine Node tests and browser suites in Chromium/Firefox/WebKit.
2. Test Survey 5/5 rounds with mixed English/Spanish guests and rank-equivalent score / reveal counts.
3. Test Category 5/5 rounds, accents, exact matching, invalid words and shared uniqueness counts.
4. Check 320px/390px phone controllers, no-scrolling play, reconnect and text accessibility.
5. Do not merge/deploy until parent PR #131 is verified. After #131 merges, retarget this PR to main and re-run all checks.
