// SPDX-License-Identifier: AGPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { assignHazardSlots } from '../render/race-hazard-slots.js';

test('surviving hazards keep their visual slot when an earlier one expires', () => {
  const first = assignHazardSlots(
    [{ x: 10, y: 20 }, { x: 30, y: 40 }, { x: 50, y: 60 }],
    [null, null, null],
    3,
  );
  assert.deepEqual(first, ['10,20', '30,40', '50,60']);

  const second = assignHazardSlots(
    [{ x: 30, y: 40 }, { x: 50, y: 60 }],
    first,
    3,
  );
  assert.deepEqual(second, [null, '30,40', '50,60']);
});

test('new hazards reuse only free slots and invalid entries are ignored', () => {
  const before = ['10,20', null, null];
  const next = assignHazardSlots(
    [{ x: 70, y: 80 }, { x: NaN, y: 1 }, { x: 70, y: 80 }, { x: 10, y: 20 }],
    before,
    3,
  );
  assert.deepEqual(next, ['10,20', '70,80', null]);
  assert.deepEqual(assignHazardSlots([{ x: 1, y: 2 }], [], 0), []);
});
