import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPLIT_CAMERA_LIMIT,
  splitGrid,
  getSplitLayout,
} from '../render/race-split-layout.js';

const grids = new Map([
  [1, [1, 1]],
  [2, [2, 1]],
  [3, [2, 2]],
  [4, [2, 2]],
  [5, [3, 2]],
  [6, [3, 2]],
  [7, [3, 3]],
  [8, [3, 3]],
]);

test('split-screen camera limit is eight and maps every supported player count', () => {
  assert.equal(SPLIT_CAMERA_LIMIT, 8);
  for (const [count, grid] of grids) {
    assert.deepEqual(splitGrid(count), { columns: grid[0], rows: grid[1], capacity: grid[0] * grid[1] });
  }
  for (const count of [0, 9, 20]) assert.equal(splitGrid(count), null);
});

test('player counts 1 through 8 use the required grid and row-major cells', () => {
  for (const [count, [columns, rows]] of grids) {
    const layout = getSplitLayout(count, 1200, 720);
    assert.equal(layout.columns, columns, `${count} columns`);
    assert.equal(layout.rows, rows, `${count} rows`);
    assert.equal(layout.cells.length, count, `${count} player cells`);
    assert.equal(layout.all.length, columns * rows, `${count} total cells`);
    const cellWidth = 1200 / columns, cellHeight = 720 / rows;
    layout.cells.forEach((cell, index) => {
      const column = index % columns, row = Math.floor(index / columns);
      assert.equal(cell.index, index);
      assert.equal(cell.column, column);
      assert.equal(cell.row, row);
      assert.deepEqual(cell.css, {
        x: column * cellWidth,
        y: row * cellHeight,
        width: cellWidth,
        height: cellHeight,
      });
      assert.deepEqual(cell.gl, {
        x: column * cellWidth,
        y: 720 - (row + 1) * cellHeight,
        width: cellWidth,
        height: cellHeight,
      });
    });
  }
});

test('seven and eight players reserve unused grid cells for standings', () => {
  const seven = getSplitLayout(7, 1200, 720);
  assert.equal(seven.extras.length, 2);
  assert.deepEqual(seven.extras.map(cell => cell.index), [7, 8]);
  assert.ok(seven.extras.every(cell => cell.kind === 'standings'));

  const eight = getSplitLayout(8, 1200, 720);
  assert.equal(eight.extras.length, 1);
  assert.deepEqual(eight.extras.map(cell => cell.index), [8]);
});

test('integer rectangles tile the whole canvas without overlap', () => {
  const width = 1001, height = 601;
  for (const count of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const cells = getSplitLayout(count, width, height).all.map(cell => cell.gl);
    let area = 0;
    for (const rect of cells) {
      assert.ok(rect.x >= 0 && rect.y >= 0, `${count} rect inside lower-left origin`);
      assert.ok(rect.x + rect.width <= width, `${count} rect right edge`);
      assert.ok(rect.y + rect.height <= height, `${count} rect top edge`);
      area += rect.width * rect.height;
    }
    assert.equal(area, width * height, `${count} rects cover the canvas`);
    for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i], b = cells[j];
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      assert.ok(overlapX <= 0 || overlapY <= 0, `${count} cells ${i}/${j} do not overlap`);
    }
  }
});

test('split layout is unavailable outside one to eight players', () => {
  for (const count of [0, 9, 12, 20]) assert.equal(getSplitLayout(count, 1200, 720), null);
});
