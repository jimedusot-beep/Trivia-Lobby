import type { Card } from "@shared/schema";
import { universalQuestionSchema, type UniversalQuestion } from "@shared/universal-questions";
import { withOpaqueOptionIds } from "./opaque-question-options";

/** Server-owned metadata is NEVER sent to players. */
export type LiveCard = Card & { universal?: UniversalQuestion; timeLimitMs?: number; pointsFactor?: number };
export type LiveKind = "multiple_choice" | "true_false" | "multiple_select" | "ordering";

/**
 * Convert a verified universal definition to a private in-room card. Unsupported
 * question kinds are left in the study bank and cannot silently enter live play.
 */
export function liveCardFromUniversal(deckId: number, id: number, raw: UniversalQuestion): LiveCard | null {
  const q = withOpaqueOptionIds(universalQuestionSchema.parse(raw));
  const a = q.answer;
  if (a.kind !== "multiple_choice" && a.kind !== "true_false" &&
      a.kind !== "multiple_select" && a.kind !== "ordering") return null;
  if ((a.kind === "multiple_choice" && a.options.length > 4) ||
      (a.kind === "multiple_select" && a.options.length > 8) ||
      (a.kind === "ordering" && a.items.length > 8)) return null;
  const options = a.kind === "true_false" ? ["True", "False"] :
    a.kind === "ordering" ? a.items.map(item => item.label) : a.options.map(item => item.label);
  const correctOption = a.kind === "multiple_choice"
    ? String.fromCharCode(65 + a.options.findIndex(option => option.id === a.correctOptionIds[0]))
    : a.kind === "true_false" ? (a.correct ? "A" : "B") : null;
  return {
    id: -id, deckId, position: 0, type: "multiple_choice",
    front: q.prompt, back: q.explanation ?? "", options, correctOption, createdAt: null,
    universal: q,
    ...(q.gameplay?.timeLimitSeconds ? { timeLimitMs: q.gameplay.timeLimitSeconds * 1000 } : {}),
    ...(q.gameplay?.points === "double" ? { pointsFactor: 2 } : {}),
  };
}

