import { AsyncLocalStorage } from "node:async_hooks";

const delivery = new AsyncLocalStorage();

/** A room operation may prepare frames, but only its successful commit releases them. */
export function deliver(effect) {
  const context = delivery.getStore();
  if (context?.active) context.effects.push(effect);
  else effect();
}

export async function withDeferredDelivery(operation, commit) {
  const context = { active: true, effects: [] };
  try {
    const result = await delivery.run(context, operation);
    await commit();
    context.active = false;
    for (const effect of context.effects) effect();
    return result;
  } finally {
    context.active = false;
    context.effects.length = 0;
  }
}
