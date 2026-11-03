// Original, ephemeral, server-authoritative Game Night Championship.
// Scores across unlike games are normalized to placement points; a new QR room
// starts a fresh event. No database/account changes or browser-owned awards.
const MAX_GAMES = 40;
const MAX_COMPLETED_IDS = 80;
const award = place => Math.max(10, 100 - 20 * (place - 1));

export function newChampionship() {
  return { entries: new Map(), games: [], completed: new Set(), playedTotal: 0 };
}

// Called exactly when a complete (not abandoned/interrupted) game reaches finished.
// A zero-score participant receives no championship points, but played is recorded.
export function completeChampionshipGame(party) {
  const champ = party.championship;
  if (!champ || !party.matchId || !Array.isArray(party.roster) ||
      champ.completed.has(party.matchId) || party.interrupted || party.endedByHost) return false;
  const players = party.roster.map(id => party.players.get(id)).filter(Boolean);
  if (players.length < 2) return false;
  const ranked = [...players].sort((a,b) => b.score - a.score || a.name.localeCompare(b.name));
  let rank = 0;
  const results = ranked.map((player,i) => {
    if (!i || player.score !== ranked[i-1].score) rank = i+1;
    const points = player.score > 0 ? award(rank) : 0;
    let entry = champ.entries.get(player.id);
    if (!entry) { entry = { id:player.id, name:player.name, points:0, games:0, wins:0 }; champ.entries.set(player.id, entry); }
    entry.name = player.name;
    entry.games += 1;
    entry.points += points;
    if (points === 100) entry.wins += 1;
    return { id:player.id, name:player.name, matchScore:player.score, place:rank, points };
  });
  champ.completed.add(party.matchId);
  // Unlike the bounded history list, this counter keeps advancing after 40 games.
  champ.playedTotal = Math.min(Number.MAX_SAFE_INTEGER, (champ.playedTotal ?? champ.games.length) + 1);
  if (champ.completed.size > MAX_COMPLETED_IDS) champ.completed.delete(champ.completed.values().next().value);
  champ.games.push({
    matchId:party.matchId, mode:party.mode, finishedAt:party.clock(),
    results,
  });
  if (champ.games.length > MAX_GAMES) champ.games.shift();
  return true;
}

export function projectChampionship(party) {
  const champ = party.championship;
  const standings = [...champ.entries.values()].sort((a,b) =>
    b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name))
    .map(({ id,name,points,games,wins }) => ({ id,name,points,games,wins }));
  return {
    gamesPlayed: champ.games.length,
    standings,
    recent: champ.games.slice(-5).reverse().map(({ matchId,mode,results }) => ({
      matchId, mode, winners: results.filter(x => x.points === 100).map(x => x.name),
    })),
  };
}
