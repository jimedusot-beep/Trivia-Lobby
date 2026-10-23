import { randomUUID } from "node:crypto";
import { universalQuestionSchema, type UniversalQuestion } from "@shared/universal-questions";

/**
 * Re-key a server-owned question snapshot before any guest sees option IDs.
 *
 * Author-created identifiers may contain answer hints (e.g. "first", "correct").
 * Private correct-answer references and public choices are remapped together.
 * Persist the resulting snapshot for assignments, or retain in room memory
 * for live games, so reconnects and server grading remain consistent.
 */
export function withOpaqueOptionIds(question: UniversalQuestion): UniversalQuestion {
  const answer=question.answer;
  if (answer.kind === "multiple_choice" || answer.kind === "multiple_select") {
    const ids=new Map(answer.options.map(option=>[option.id,randomUUID()]));
    return universalQuestionSchema.parse({
      ...question,
      answer:{
        ...answer,
        options:answer.options.map(option=>({...option,id:ids.get(option.id)!})),
        correctOptionIds:answer.correctOptionIds.map(id=>ids.get(id)!),
      },
    });
  }
  if (answer.kind === "ordering") {
    const ids=new Map(answer.items.map(option=>[option.id,randomUUID()]));
    return universalQuestionSchema.parse({
      ...question,
      answer:{
        ...answer,
        items:answer.items.map(option=>({...option,id:ids.get(option.id)!})),
        correctOrderIds:answer.correctOrderIds.map(id=>ids.get(id)!),
      },
    });
  }
  return question;
}
