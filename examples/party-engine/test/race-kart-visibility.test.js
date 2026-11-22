import test from 'node:test';
import assert from 'node:assert/strict';
import { splitVisibleKartNumbers } from '../render/race-kart-visibility.js';

const kart = (number, x, y, rank = number) => ({ number, x, y, rank });

test('the followed kart keeps camera identity and nearest rivals fill the remaining slots', () => {
  const karts = [
    kart(1, 100, 100, 1),
    kart(2, 3, 4, 2),
    kart(3, 1, 1, 3),
    kart(4, 0, 0, 4),
  ];
  assert.deepEqual(splitVisibleKartNumbers(karts, 4, { limit: 3 }), [4, 3, 2]);
});

test('equal-distance rivals resolve by kart number, not frame order', () => {
  const karts = [kart(7, 10, 0, 7), kart(2, 0, 10, 2), kart(5, 0, 0, 5)];
  assert.deepEqual(splitVisibleKartNumbers(karts, 5, { limit: 3 }), [5, 2, 7]);
});

test('the visible set is bounded and never mutates the authoritative frame', () => {
  const karts = Object.freeze([
    Object.freeze(kart(1, 0, 0, 1)),
    Object.freeze(kart(2, 1, 0, 2)),
    Object.freeze(kart(3, 2, 0, 3)),
    Object.freeze(kart(4, 3, 0, 4)),
  ]);
  assert.deepEqual(splitVisibleKartNumbers(karts, 1, { limit: 2 }), [1, 2]);
  assert.deepEqual(karts.map(k => k.number), [1, 2, 3, 4]);
});

test('a missing focus falls back to the leading karts in rank order', () => {
  const karts = [kart(8, 0, 0, 3), kart(2, 5, 5, 1), kart(5, 1, 1, 2)];
  assert.deepEqual(splitVisibleKartNumbers(karts, 99, { limit: 2 }), [2, 5]);
});

test('malformed coordinates cannot displace a valid followed kart', () => {
  const karts = [kart(1, NaN, 0, 1), kart(2, Infinity, 0, 2), kart(3, 2, 0, 3), kart(4, 0, 0, 4)];
  assert.deepEqual(splitVisibleKartNumbers(karts, 4, { limit: 3 }), [4, 3]);
});
