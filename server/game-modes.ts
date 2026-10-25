export type GameMode = "classic" | "teams" | "buzzer" | "wager" | "workshop" | "party" | "sprint";
export const UPGRADE_COST = { focus: 60, guard: 40 } as const;
/** Game points are separate from study mastery and review schedules. */
export function scoreRound(input: {
  mode: GameMode; correct: boolean; streak: number; score: number; wager: number;
  focus: number; guard: number; round: number; pointsFactor?: number;
  responseMs?: number; timeLimitMs?: number;
}) {
  const { mode, correct, streak, score, focus, guard, round } = input;
  const wager = mode === "wager" ? input.wager : 0;
  if (!Number.isInteger(wager) || wager < 0 || wager > Math.min(score, 100))
    throw new Error("Wager exceeds available points (maximum 100)");
  const bonus = mode === "workshop" && focus > 0 ? 50 : 0;
  const multiplier = mode === "party" && round % 3 === 2 ? 2 : 1;
  const duration = Number.isFinite(input.timeLimitMs) && (input.timeLimitMs ?? 0) > 0 ? input.timeLimitMs! : 30_000;
  const elapsed = Number.isFinite(input.responseMs) && (input.responseMs ?? -1) >= 0 ? input.responseMs! : duration;
  // Sprint uses only the server's elapsed receipt time. Correct = 500–1,000 points.
  const sprintPoints = 500 + Math.floor(500 * (1 - Math.min(1, elapsed / duration)));
  const awarded = correct
    ? mode === "sprint" ? Math.round(sprintPoints * (input.pointsFactor ?? 1))
      : (100 + streak * 10 + bonus) * multiplier * (input.pointsFactor ?? 1) + wager
    : (wager > 0 ? -wager : 0);
  return {
    awarded,
    streak: correct ? streak + 1 : mode === "workshop" && guard > 0 ? streak : 0,
    coins: correct ? 20 : 0,
    focus: mode === "workshop" && correct ? Math.max(0, focus - 1) : focus,
    guard: mode === "workshop" && !correct ? Math.max(0, guard - 1) : guard,
  };
}
