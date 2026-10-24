import { listUniversalQuestions } from "./universal-question-store";
import { liveCardFromUniversal } from "./live-question-projection";
import type { LiveCard } from "./live-question-projection";

export { liveCardFromUniversal } from "./live-question-projection";
export type { LiveCard, LiveKind } from "./live-question-projection";

/** Private definitions are loaded only for a deck already authorized for hosting. */
export async function universalGameCards(deckId: number): Promise<LiveCard[]> {
  const rows = await listUniversalQuestions(deckId);
  return rows.flatMap(({id, question}) => {
    const card = liveCardFromUniversal(deckId, id, question);
    return card ? [card] : [];
  });
}
