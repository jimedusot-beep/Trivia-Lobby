// SPDX-License-Identifier: AGPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { smoothStrokePath } from "../public/drawing-stroke.js";

test("empty or malformed stroke draws nothing", () => {
  assert.equal(smoothStrokePath([]), "");
  assert.equal(smoothStrokePath([[0, 0], [NaN, 2]]), "");
  assert.equal(smoothStrokePath([[1, 2], [3]]), "");
});
test("single-point and two-point strokes preserve previous semantics", () => {
  assert.equal(smoothStrokePath([[500, 500]]), "M 500 500");
  assert.equal(smoothStrokePath([[0, 0], [100, 100]]), "M 0 0 L 100 100");
});
test("a gesture with three points uses smooth curves and keeps both endpoints", () => {
  assert.equal(smoothStrokePath([[0, 0], [100, 0], [100, 100]]),
    "M 0 0 Q 100 0 100 50 Q 100 100 100 100");
});
test("drawing conversion is deterministic and never alters server-owned points", () => {
  const points = Object.freeze([Object.freeze([12, 19]), Object.freeze([22, 30]), Object.freeze([35, 44]), Object.freeze([50, 55])]);
  const before = JSON.stringify(points);
  const first = smoothStrokePath(points);
  assert.equal(first, smoothStrokePath(points));
  assert.match(first, /^M 12 19/);
  assert.match(first, /50 55$/);
  assert.equal(JSON.stringify(points), before);
});
