import type { Card } from "@shared/schema";

export type PracticeQuestion = {
  id: number;
  front: string;
  back: string;
  choices: string[];
  answerIndex: number | null;
};

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Builds solo-practice questions from saved decks without modifying source cards. */
export function buildPracticeQuestions(
  cards: Pick<Card, "id" | "front" | "back" | "type" | "options" | "correctOption">[],
  random: () => number = Math.random,
): PracticeQuestion[] {
  const backs = Array.from(new Set(cards.map(card => card.back.trim()).filter(Boolean)));
  return shuffle(cards, random).map(card => {
    const options = Array.isArray(card.options)
      ? card.options.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
      : [];
    let answerIndex = -1;
    if (card.type === "multiple_choice") {
      const raw = card.correctOption?.trim() || "";
      const letterIndex = ["A", "B", "C", "D"].indexOf(raw.toUpperCase());
      answerIndex = letterIndex >= 0 ? letterIndex : options.findIndex(option => option === raw);
    }
    if (options.length >= 2 && answerIndex >= 0 && answerIndex < options.length) {
      return { id: card.id, front: card.front, back: card.back, choices: options, answerIndex };
    }

    const otherAnswers = backs.filter(back => back !== card.back.trim());
    if (otherAnswers.length >= 2) {
      const choices = shuffle([card.back.trim(), ...shuffle(otherAnswers, random).slice(0, 3)], random);
      return { id: card.id, front: card.front, back: card.back, choices, answerIndex: choices.indexOf(card.back.trim()) };
    }

    // Small decks remain usable: reveal-and-rate rather than fabricate wrong answers.
    return { id: card.id, front: card.front, back: card.back, choices: [], answerIndex: null };
  });
}
