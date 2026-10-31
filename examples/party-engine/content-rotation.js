// Bounded, allocation-free selection of fresh content over repeated games.
// The active match keeps its sequence stable because the championship ledger
// only advances once a game reaches "finished". Existing first-match examples
// remain unchanged, but rematches use the next group of prompts.
export function contentAt(pool, completedMatches, roundIndex, matchSize) {
  if (!Array.isArray(pool) || !pool.length || !Number.isSafeInteger(completedMatches) ||
      completedMatches < 0 || !Number.isSafeInteger(roundIndex) || roundIndex < 0 ||
      !Number.isSafeInteger(matchSize) || matchSize < 1 || matchSize > pool.length ||
      roundIndex >= matchSize) throw new Error("Invalid content selection.");
  return pool[(completedMatches * matchSize + roundIndex) % pool.length];
}
export function roundContent(party, pool, matchSize) {
  return contentAt(pool, party.championship.games.length, party.index, matchSize);
}
export function matchContent(pool, completedMatches, matchSize) {
  return Array.from({length:matchSize},(_,index) => contentAt(pool,completedMatches,index,matchSize));
}
