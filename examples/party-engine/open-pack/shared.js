// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomInt, randomUUID } from "node:crypto";
export {
  fail,
  requireFields,
  readable,
  integer,
  normalized,
} from "../public/pack-validation.js";
import { fail } from "../public/pack-validation.js";
export function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export { randomInt, randomUUID };
export function award(p, id, points) {
  const player = p.players.get(id);
  if (player) {
    player.score += points;
    player.correct++;
  }
}
export function hostOnly(actor) {
  if (actor !== "host") fail("Only the host can do that.");
}
export function playerOnly(p, actor) {
  if (actor === "host" || !p.roster.includes(actor))
    fail("Only joined players can play.");
}
export function renewed(p, ms = 30000) {
  p.enter("playing", ms);
}
