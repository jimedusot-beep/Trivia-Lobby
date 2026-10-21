import type { Card } from "@shared/schema";

export const QUESTION_TIME_MS = 30_000;
export const MAX_GAME_PLAYERS = 50;

export type GameQuestion = {
  id: number;
  prompt: string;
  choices: string[];
  correctLetter: string;
  explanation: string;
};
export type ScorePlayer = {
  id: string;
  name: string;
  score: number;
  streak: number;
  lastPoints: number;
};

export function playableQuestions(cards: Card[]): GameQuestion[] {
  return cards.flatMap(card => {
    if (card.type !== "multiple_choice" || !Array.isArray(card.options)) return [];
    const choices = card.options;
    if (choices.length < 2 || choices.length > 4 ||
        !choices.every(x => typeof x === "string" && x.trim().length > 0)) return [];
    const correctLetter = typeof card.correctOption === "string" ? card.correctOption.trim().toUpperCase() : "";
    const answerIndex = ["A", "B", "C", "D"].indexOf(correctLetter);
    if (answerIndex < 0 || answerIndex >= choices.length) return [];
    if (!card.front?.trim()) return [];
    return [{
      id: card.id,
      prompt: card.front,
      choices,
      correctLetter,
      explanation: card.back,
    }];
  });
}

export function publicLeaderboard(players: Iterable<ScorePlayer>) {
  return Array.from(players, p => ({
    playerId: p.id,
    name: p.name,
    score: p.score,
    lastPoints: p.lastPoints,
  })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function applyAnswer(player: ScorePlayer, correctLetter: string, answer: unknown): boolean {
  const isCorrect = typeof answer === "string" && answer.trim().toUpperCase() === correctLetter;
  player.lastPoints = isCorrect ? 100 + player.streak * 10 : 0;
  player.score += player.lastPoints;
  player.streak = isCorrect ? player.streak + 1 : 0;
  return isCorrect;
}
