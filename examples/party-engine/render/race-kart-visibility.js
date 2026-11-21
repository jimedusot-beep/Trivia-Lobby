// SPDX-License-Identifier: AGPL-3.0-or-later
// Pure per-view kart selection. Keeps camera identity and bounds split draw calls.

export const DEFAULT_SPLIT_VISIBLE_KARTS = 4;

function ranked(a, b) {
  return (Number(a.rank) || Infinity) - (Number(b.rank) || Infinity) || a.number - b.number;
}

export function splitVisibleKartNumbers(karts, focusNumber, options = {}) {
  const list = Array.isArray(karts) ? karts : [];
  const requested = Number(options.limit);
  const limit = Math.max(1, Math.min(8,
    Number.isFinite(requested) ? Math.floor(requested) : DEFAULT_SPLIT_VISIBLE_KARTS));
  const valid = list.filter(kart => kart && Number.isFinite(kart.number) &&
    Number.isFinite(kart.x) && Number.isFinite(kart.y));

  const focus = valid.find(kart => kart.number === focusNumber);
  if (!focus) return valid.slice().sort(ranked).slice(0, limit).map(kart => kart.number);

  const rivals = valid
    .filter(kart => kart.number !== focusNumber)
    .map(kart => ({
      number: kart.number,
      distance: (kart.x - focus.x) ** 2 + (kart.y - focus.y) ** 2,
    }))
    .sort((a, b) => a.distance - b.distance || a.number - b.number);
  // POV views reserve the focus slot for the camera itself: showing that kart
  // would put its own body across the lens. Rival count still uses the shared
  // per-view budget so POV cannot exceed the existing split draw-call envelope.
  const rivalCount = Math.max(0, limit - 1);
  const visibleRivals = rivals.slice(0, rivalCount).map(rival => rival.number);
  return options.excludeFocus ? visibleRivals : [focusNumber, ...visibleRivals];
}
