import test from "node:test";
import assert from "node:assert/strict";
import { windowLimiter } from "./rate-limit";
test("limits span sockets, expire and resist identity churn without resetting windows", () => {
  const allow = windowLimiter(2, 100, 2);
  assert(allow("ip", 0)); assert(allow("ip", 1)); assert(!allow("ip", 2));
  assert(allow("second", 3)); assert(!allow("third", 4));
  assert(!allow("ip", 5)); assert(allow("third", 101));
});
