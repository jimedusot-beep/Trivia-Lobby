/**
 * Trivia Lobby universal question interchange model (v1).
 *
 * This is an additive, application-owned schema. It does not assume that
 * proprietary exports or third-party projects share these structures.
 * Existing cards/DB routes are intentionally unchanged.
 */
import { z } from "zod";

const textAnswer = z.object({
  kind: z.literal("text"),
  acceptedAnswers: z.array(z.string().trim().min(1)).min(1),
  caseSensitive: z.boolean().default(false),
});
const multipleChoice = z.object({
  kind: z.literal("multiple_choice"),
  options: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
  })).min(2),
  correctOptionIds: z.array(z.string().min(1)).min(1),
}).superRefine((value, ctx) => {
  const ids = value.options.map(o => o.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Option IDs must be unique" });
  }
  if (new Set(value.correctOptionIds).size !== value.correctOptionIds.length ||
      value.correctOptionIds.some(id => !ids.includes(id))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Correct IDs must be unique and appear in options" });
  }
});
const imageHotspot = z.object({
  kind: z.literal("image_hotspot"),
  imageAssetId: z.string().min(1),
  // Normalized image coordinates in [0,1], independent of display size.
  targets: z.array(z.object({
    id: z.string().min(1),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    radius: z.number().gt(0).max(1),
    label: z.string().min(1),
  })).min(1),
  correctTargetIds: z.array(z.string().min(1)).min(1),
}).superRefine((value, ctx) => {
  const ids = value.targets.map(t => t.id);
  if (new Set(ids).size !== ids.length ||
      new Set(value.correctTargetIds).size !== value.correctTargetIds.length ||
      value.correctTargetIds.some(id => !ids.includes(id))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hotspot IDs must be unique and valid" });
  }
});
const matching = z.object({
  kind: z.literal("matching"),
  pairs: z.array(z.object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    match: z.string().min(1),
  })).min(2),
}).superRefine((value, ctx) => {
  if (new Set(value.pairs.map(p => p.id)).size !== value.pairs.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Matching pair IDs must be unique" });
  }
});

export const universalQuestionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  prompt: z.string().trim().min(1),
  explanation: z.string().optional(),
  tags: z.array(z.string()).default([]),
  source: z.object({
    documentId: z.string().optional(),
    page: z.number().int().positive().optional(),
    attribution: z.string().optional(),
  }).optional(),
  answer: z.union([textAnswer, multipleChoice, imageHotspot, matching]),
});
export type UniversalQuestion = z.infer<typeof universalQuestionSchema>;

export const universalQuestionSetSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().trim().min(1),
  questions: z.array(universalQuestionSchema),
});
export type UniversalQuestionSet = z.infer<typeof universalQuestionSetSchema>;

/**
 * Convert supported current database cards to portable questions.
 * Reject malformed records rather than silently inventing correct answers.
 */
export function legacyCardToQuestion(card: {
  id: number; front: string; back: string; type: string;
  options: unknown; correctOption: string | null;
}): UniversalQuestion {
  if (card.type === "multiple_choice") {
    const options = z.array(z.string()).min(2).parse(card.options);
    const correct = (card.correctOption ?? "").trim().toUpperCase();
    if (!/^[A-Z]$/.test(correct) || correct.charCodeAt(0) - 65 >= options.length) {
      throw new Error(`Card ${card.id}: invalid correct option`);
    }
    return universalQuestionSchema.parse({
      schemaVersion: 1, id: String(card.id), prompt: card.front,
      explanation: card.back,
      answer: {
        kind: "multiple_choice",
        options: options.map((label, index) => ({ id: String.fromCharCode(65 + index), label })),
        correctOptionIds: [correct],
      },
    });
  }
  if (card.type !== "flashcard") throw new Error(`Card ${card.id}: unsupported type`);
  return universalQuestionSchema.parse({
    schemaVersion: 1, id: String(card.id), prompt: card.front,
    answer: { kind: "text", acceptedAnswers: [card.back] },
  });
}
