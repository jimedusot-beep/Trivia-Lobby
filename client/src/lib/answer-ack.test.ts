import assert from "node:assert/strict";
import test from "node:test";
import { shouldAcceptAnswerAck } from "./answer-ack";

test("late previous-question acknowledgement cannot lock next-round controls", () => {
  assert.equal(shouldAcceptAnswerAck(2, 1), false);
  assert.equal(shouldAcceptAnswerAck(2, 0), false);
});

test("matching authoritative question acknowledgement is honored", () => {
  assert.equal(shouldAcceptAnswerAck(2, 2), true);
  assert.equal(shouldAcceptAnswerAck(0, 0), true);
});

test("acknowledgements without an active question are ignored", () => {
  assert.equal(shouldAcceptAnswerAck(undefined, 0), false);
});
