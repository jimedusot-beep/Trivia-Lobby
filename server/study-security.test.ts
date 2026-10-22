import test from "node:test";
import assert from "node:assert/strict";
import { trustedStudyOrigin } from "./study-security";

test("study mutation origin protection", () => {
  assert.equal(trustedStudyOrigin("https://trivia.example", "trivia.example", "same-origin"), true);
  assert.equal(trustedStudyOrigin("https://trivia.example:443", "trivia.example", "same-origin"), true);
  assert.equal(trustedStudyOrigin("https://trivia.example", "trivia.example", "cross-site"), false);
  assert.equal(trustedStudyOrigin("https://attacker.example", "trivia.example", "same-site"), false);
  assert.equal(trustedStudyOrigin("https://evil.trivia.example", "trivia.example", "same-site"), false);
  assert.equal(trustedStudyOrigin("javascript:alert(1)", "trivia.example", "same-origin"), false);
  assert.equal(trustedStudyOrigin("http://[", "trivia.example", undefined), false);
  assert.equal(trustedStudyOrigin("https://trivia.example.evil", "trivia.example", undefined), false);
  assert.equal(trustedStudyOrigin("https://trivia.example/sneaky", "trivia.example", undefined), false);
  assert.equal(trustedStudyOrigin("https://trivia.example", undefined, undefined), false);
  assert.equal(trustedStudyOrigin(undefined, "trivia.example", "cross-site"), false);
});
