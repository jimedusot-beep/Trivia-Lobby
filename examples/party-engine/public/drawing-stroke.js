// SPDX-License-Identifier: AGPL-3.0-or-later
// Presentation-only quadratic smoothing. Authoritative stroke points are unchanged.
export function smoothStrokePath(points) {
  if (!Array.isArray(points) || points.length === 0) return "";
  if (!points.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)))
    return "";
  const first = points[0];
  let path = `M ${first[0]} ${first[1]}`;
  if (points.length === 1) return path;
  if (points.length === 2) return `${path} L ${points[1][0]} ${points[1][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [cx, cy] = points[i], [nx, ny] = points[i + 1];
    path += ` Q ${cx} ${cy} ${(cx + nx) / 2} ${(cy + ny) / 2}`;
  }
  const [endX, endY] = points.at(-1);
  return `${path} Q ${endX} ${endY} ${endX} ${endY}`;
}
