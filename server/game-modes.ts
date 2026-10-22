export const GAME_MODES = ["classic", "teams", "shop", "buzzer", "wager", "party"] as const;
export type GameMode = typeof GAME_MODES[number];
export type Upgrade = "boost" | "streak_guard";
export function scoreAnswer(input: { mode: GameMode; correct: boolean; score: number; streak: number; wager: number; upgrade?: Upgrade; questionIndex: number }) {
  if (!Number.isInteger(input.wager) || input.wager < 0 || input.wager > Math.min(input.score, 300)) throw new Error("Invalid wager");
  if (input.mode !== "wager" && input.wager) throw new Error("Wagers are available in wager mode");
  const multiplier = input.mode === "party" && input.questionIndex % 2 === 1 ? 2 : 1;
  const awarded = input.correct ? (100 + Math.min(input.streak, 20) * 10 + (input.upgrade === "boost" ? 50 : 0)) * multiplier + input.wager : -input.wager;
  const streak = input.correct ? input.streak + 1 : input.upgrade === "streak_guard" ? input.streak : 0;
  return { awarded, score: input.score + awarded, streak, coins: input.correct ? 2 : 1 };
}
