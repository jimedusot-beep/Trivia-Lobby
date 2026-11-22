// SPDX-License-Identifier: AGPL-3.0-or-later
// Pure layout maths for TV split-screen viewports. No DOM or Three.js dependency.

export const SPLIT_CAMERA_LIMIT = 8;

const GRIDS = Object.freeze({
  1: [1, 1],
  2: [2, 1],
  3: [2, 2],
  4: [2, 2],
  5: [3, 2],
  6: [3, 2],
  7: [3, 3],
  8: [3, 3],
});

export function splitGrid(count) {
  if (!Number.isInteger(count)) return null;
  const grid = GRIDS[count];
  if (!grid) return null;
  return { columns: grid[0], rows: grid[1], capacity: grid[0] * grid[1] };
}

// Distribute pixels evenly, giving any remainder to the earliest cells so the
// rectangles always tile the canvas exactly with no gaps or overlaps.
function axisRanges(total, divisions) {
  const base = Math.floor(total / divisions);
  const remainder = total - base * divisions;
  const ranges = [];
  let cursor = 0;
  for (let index = 0; index < divisions; index++) {
    const size = base + (index < remainder ? 1 : 0);
    ranges.push({ start: cursor, size });
    cursor += size;
  }
  return ranges;
}

export function getSplitLayout(count, width, height) {
  const grid = splitGrid(count);
  if (!grid || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;

  const pixelWidth = Math.floor(width), pixelHeight = Math.floor(height);
  const columnsX = axisRanges(pixelWidth, grid.columns);
  const rowsY = axisRanges(pixelHeight, grid.rows);
  const canvasHeight = pixelHeight;
  const make = (index, kind) => {
    const column = index % grid.columns;
    const row = Math.floor(index / grid.columns);
    const cssX = columnsX[column].start;
    const cssY = rowsY[row].start;
    const cellWidth = columnsX[column].size;
    const cellHeight = rowsY[row].size;
    return {
      index,
      column,
      row,
      kind,
      css: { x: cssX, y: cssY, width: cellWidth, height: cellHeight },
      gl: { x: cssX, y: canvasHeight - cssY - cellHeight, width: cellWidth, height: cellHeight },
    };
  };

  const cells = [];
  for (let index = 0; index < count; index++) cells.push(make(index, 'player'));
  const extras = [];
  for (let index = count; index < grid.capacity; index++) extras.push(make(index, 'standings'));

  return {
    count,
    columns: grid.columns,
    rows: grid.rows,
    capacity: grid.capacity,
    width: pixelWidth,
    height: pixelHeight,
    cells,
    extras,
    all: cells.concat(extras),
  };
}
