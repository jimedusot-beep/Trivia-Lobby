/**
 * Application-owned universal questions (version 1).
 * Compatible with the initial model in research PR #5. No third-party code used.
 * Definitions are public on the legacy unauthenticated deck API; NEVER use its
 * authoring responses as player game payloads.
 */
import { z } from "zod";

const short = z.string().trim().min(1).max(500);
const identifier = z.string().trim().min(1).max(80);
const httpsUrl = z.string().url().max(2048).refine(value => value.startsWith("https://"), "Use an HTTPS image URL");
const option = z.object({ id: identifier, label: short });
const point = z.object({
  id: identifier, label: short,
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  radius: z.number().finite().gt(0).max(0.35),
});
function validIds(ids: string[], selected: string[], ctx: z.RefinementCtx) {
  if (new Set(ids).size !== ids.length || new Set(selected).size !== selected.length ||
      selected.some(id => !ids.includes(id))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Answer IDs must be unique and refer to existing items" });
  }
}
const textAnswer = z.object({
  kind: z.literal("text"), acceptedAnswers: z.array(short).min(1).max(20),
  caseSensitive: z.boolean().default(false),
});
const flashcard = z.object({ kind: z.literal("flashcard"), back: short });
const shortAnswer = z.object({
  kind: z.literal("short_answer"), acceptedAnswers: z.array(short).min(1).max(20),
  caseSensitive: z.boolean().default(false),
});
const multipleChoice = z.object({
  kind: z.literal("multiple_choice"), options: z.array(option).min(2).max(12),
  correctOptionIds: z.array(identifier).length(1),
}).superRefine((v, c) => validIds(v.options.map(o => o.id), v.correctOptionIds, c));
const multipleSelect = z.object({
  kind: z.literal("multiple_select"), options: z.array(option).min(2).max(12),
  correctOptionIds: z.array(identifier).min(1).max(12),
}).superRefine((v, c) => validIds(v.options.map(o => o.id), v.correctOptionIds, c));
const trueFalse = z.object({ kind: z.literal("true_false"), correct: z.boolean() });
const matching = z.object({
  kind: z.literal("matching"), pairs: z.array(z.object({
    id: identifier, prompt: short, match: short,
  })).min(2).max(20),
}).superRefine((v, c) => validIds(v.pairs.map(p => p.id), v.pairs.map(p => p.id), c));
const ordering = z.object({
  kind: z.literal("ordering"), items: z.array(option).min(2).max(20),
  correctOrderIds: z.array(identifier).min(2).max(20),
}).superRefine((v, c) => {
  validIds(v.items.map(i => i.id), v.correctOrderIds, c);
  if (v.items.length !== v.correctOrderIds.length) c.addIssue({ code: z.ZodIssueCode.custom, message: "Order must include every item" });
});
const imageHotspot = z.object({
  kind: z.literal("image_hotspot"), imageAssetId: identifier.optional(),
  imageUrl: httpsUrl.optional(), imageAlt: short.optional(),
  targets: z.array(point).min(1).max(40), correctTargetIds: z.array(identifier).min(1).max(40),
}).superRefine((v, c) => {
  validIds(v.targets.map(t => t.id), v.correctTargetIds, c);
  if (!v.imageUrl && !v.imageAssetId) c.addIssue({ code: z.ZodIssueCode.custom, message: "An image URL or asset reference is required" });
});
const dragDropLabels = z.object({
  kind: z.literal("drag_drop_labels"), imageUrl: httpsUrl,
  imageAlt: short, targets: z.array(point).min(2).max(30),
}).superRefine((v, c) => validIds(v.targets.map(t => t.id), v.targets.map(t => t.id), c));
const diagramIdentification = z.object({
  kind: z.literal("diagram_identification"), imageUrl: httpsUrl,
  imageAlt: short, targets: z.array(point).min(2).max(30),
  correctTargetIds: z.array(identifier).min(1).max(30),
}).superRefine((v,c) => validIds(v.targets.map(t => t.id), v.correctTargetIds, c));

export const universalQuestionSchema = z.object({
  schemaVersion: z.literal(1),
  id: identifier,
  prompt: z.string().trim().min(1).max(2000),
  explanation: z.string().max(4000).optional(),
  tags: z.array(short).max(20).default([]),
  source: z.object({
    documentId: identifier.optional(),
    page: z.number().int().positive().optional(),
    attribution: short.optional(),
  }).optional(),
  answer: z.union([textAnswer, multipleChoice, imageHotspot, matching,
    flashcard, multipleSelect, trueFalse, shortAnswer, ordering, dragDropLabels, diagramIdentification]),
});
export type UniversalQuestion = z.infer<typeof universalQuestionSchema>;
export const universalQuestionSetSchema = z.object({
  schemaVersion: z.literal(1), title: short, questions: z.array(universalQuestionSchema).max(5000),
});
export type UniversalQuestionSet = z.infer<typeof universalQuestionSetSchema>;

const selectedIds = z.object({ selectedIds: z.array(identifier).max(40) });
const matchedIds = z.object({ matchIds: z.record(identifier) });
const typed = z.object({ text: z.string().max(500) });
const orderedIds = z.object({ orderIds: z.array(identifier).max(30) });
const boolResponse = z.object({ value: z.boolean() });
const target = z.object({ targetId: identifier });

function sameSet(left: string[], right: string[]) {
  return left.length === right.length && left.every(id => right.includes(id)) && new Set(left).size === left.length;
}
function compareText(input: string, answers: string[], caseSensitive: boolean) {
  const normalize = (v: string) => caseSensitive ? v.trim() : v.trim().toLocaleLowerCase();
  return answers.some(a => normalize(a) === normalize(input));
}
/** Use on the SERVER for scored answers. Throws on malformed response. */
export function gradeUniversalAnswer(question: UniversalQuestion, response: unknown): boolean {
  switch (question.answer.kind) {
    case "multiple_choice":
    case "multiple_select": return sameSet(selectedIds.parse(response).selectedIds, question.answer.correctOptionIds);
    case "image_hotspot":
    case "diagram_identification": return question.answer.correctTargetIds.includes(target.parse(response).targetId);
    case "matching":
    case "drag_drop_labels": {
      const submitted = matchedIds.parse(response).matchIds;
      const ids = question.answer.kind === "matching" ? question.answer.pairs.map(p => p.id) : question.answer.targets.map(t => t.id);
      return Object.keys(submitted).length === ids.length && ids.every(id => submitted[id] === id);
    }
    case "ordering": return JSON.stringify(orderedIds.parse(response).orderIds) === JSON.stringify(question.answer.correctOrderIds);
    case "true_false": return boolResponse.parse(response).value === question.answer.correct;
    case "flashcard": return compareText(typed.parse(response).text, [question.answer.back], false);
    case "text":
    case "short_answer": return compareText(typed.parse(response).text, question.answer.acceptedAnswers, question.answer.caseSensitive);
  }
}
/** Player-facing projection only; does not expose answer keys, matches or text answers. */
export function withoutAnswerKeys(question: UniversalQuestion) {
  const { answer, ...base } = question;
  switch (answer.kind) {
    case "multiple_choice": case "multiple_select":
      return { ...base, answer: { kind: answer.kind, options: answer.options } };
    case "matching": return { ...base, answer: { kind: answer.kind, prompts: answer.pairs.map(p => ({ id: p.id, prompt: p.prompt })), matches: answer.pairs.map(p => ({ id: p.id, label: p.match })) } };
    case "ordering": return { ...base, answer: { kind: answer.kind, items: answer.items } };
    case "image_hotspot": case "diagram_identification":
      return { ...base, answer: { kind: answer.kind, imageUrl: answer.imageUrl, imageAlt: answer.imageAlt, targets: answer.targets.map(({id,x,y,radius}) => ({id,x,y,radius})) } };
    case "drag_drop_labels": return { ...base, answer: { kind: answer.kind, imageUrl: answer.imageUrl, imageAlt: answer.imageAlt, targets: answer.targets.map(({id,x,y,radius}) => ({id,x,y,radius})), labels: answer.targets.map(t => ({id:t.id,label:t.label})) } };
    case "true_false": return { ...base, answer: { kind: answer.kind } };
    default: return { ...base, answer: { kind: answer.kind } };
  }
}
/** Lossless adapter for the two supported legacy card types. */
export function legacyCardToQuestion(card: {
  id: number; front: string; back: string; type: string;
  options: unknown; correctOption: string | null;
}): UniversalQuestion {
  if (card.type === "multiple_choice") {
    const options = z.array(short).min(2).max(12).parse(card.options);
    const correct = (card.correctOption ?? "").trim().toUpperCase();
    if (!/^[A-Z]$/.test(correct) || correct.charCodeAt(0)-65 >= options.length) {
      throw new Error(`Card ${card.id}: invalid correct option`);
    }
    return universalQuestionSchema.parse({ schemaVersion:1, id:String(card.id), prompt:card.front, explanation:card.back,
      answer: { kind:"multiple_choice", options:options.map((label,index)=>({id:String.fromCharCode(65+index),label})), correctOptionIds:[correct] } });
  }
  if (card.type !== "flashcard") throw new Error(`Card ${card.id}: unsupported type`);
  return universalQuestionSchema.parse({ schemaVersion:1,id:String(card.id),prompt:card.front,
    answer:{kind:"text",acceptedAnswers:[card.back]} });
}
