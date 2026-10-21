/**
 * Evidence-driven room projection.
 * Outputs plain public data, never transport internals or WebSocket references.
 * Architectural pattern: narrow observable-output contracts and differential
 * assertions from documented reverse-engineering case studies.
 */
export type RoomPlayerView = {
  playerId: string;
  name: string;
  score: number;
  connected: boolean;
};

export type PublicLeaderboardEntry = Pick<RoomPlayerView, "playerId" | "name" | "score">;

export function publicPlayerView(player: {
  id: string;
  name: string;
  score: number;
  connected: boolean;
}): RoomPlayerView {
  return { playerId: player.id, name: player.name, score: player.score, connected: player.connected };
}

export function publicLeaderboard(players: Iterable<{
  id: string;
  name: string;
  score: number;
}> , limit = 5): PublicLeaderboardEntry[] {
  return Array.from(players, ({ id, name, score }) => ({ playerId: id, name, score }))
    .sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId))
    .slice(0, Math.max(0, Math.floor(limit)));
}

export function canSubmitAnswer(input: {
  gameState: string;
  connected: boolean;
  socketMatchesPlayer: boolean;
  alreadyAnswered: boolean;
  questionExists: boolean;
}): boolean {
  return input.gameState === "playing" &&
    input.connected &&
    input.socketMatchesPlayer &&
    !input.alreadyAnswered &&
    input.questionExists;
}
