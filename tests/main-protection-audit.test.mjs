import test from "node:test";
import assert from "node:assert/strict";
import { evaluateMainProtection, REQUIRED_CHECKS } from "../script/audit-main-protection.mjs";

const full = () => ({
  name: "Protect Trivia Lobby main",
  enforcement: "active",
  target: "branch",
  conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
  rules: [
    { type: "deletion" },
    { type: "non_fast_forward" },
    { type: "pull_request", parameters: {
      required_approving_review_count: 1,
      dismiss_stale_reviews_on_push: true
    } },
    { type: "required_status_checks", parameters: {
      strict_required_status_checks_policy: true,
      required_status_checks: REQUIRED_CHECKS.map(context => ({ context, integration_id: 15368 }))
    } }
  ]
});
const evaluate = (...rulesets) => evaluateMainProtection({ branchProtected: true, rulesets });

test("full ruleset meets the actual named CI, browser, and review protections", () => {
  const report = evaluate(full());
  assert.equal(report.ok, true);
  assert.equal(report.results.filter(row => !row.ok).length, 0);
  assert.deepEqual(report.requiredChecksObserved, [...REQUIRED_CHECKS].sort());
});

test("current documented protection identifies core CI, stale branches, and review gaps", () => {
  const ruleset = full();
  const pr = ruleset.rules.find(rule => rule.type === "pull_request");
  const status = ruleset.rules.find(rule => rule.type === "required_status_checks");
  pr.parameters.required_approving_review_count = 0;
  pr.parameters.dismiss_stale_reviews_on_push = false;
  status.parameters.strict_required_status_checks_policy = false;
  status.parameters.required_status_checks =
    status.parameters.required_status_checks.filter(row => row.context !== "checks");

  const report = evaluate(ruleset);
  assert.equal(report.ok, false);
  const misses = report.results.filter(row => !row.ok).map(row => row.name);
  assert.deepEqual(misses, [
    "Required status check: checks",
    "Updated branches required",
    "Independent approving review",
    "Stale reviews dismissed on new commits"
  ]);
});

test("no rules, disabled rulesets, and wrong branch cannot falsely pass", () => {
  assert.equal(evaluateMainProtection({ branchProtected: false, rulesets: [] }).ok, false);
  const disabled = full();
  disabled.enforcement = "evaluate";
  assert.equal(evaluate(disabled).ok, false);
  const other = full();
  other.conditions.ref_name.include = ["refs/heads/development"];
  assert.equal(evaluate(other).ok, false);
  const excluded = full();
  excluded.conditions.ref_name.exclude = ["~DEFAULT_BRANCH"];
  assert.equal(evaluate(excluded).ok, false);
});

test("missing individual required checks are detected by exact context, not workflow title", () => {
  for (const check of REQUIRED_CHECKS) {
    const policy = full();
    const status = policy.rules.find(row => row.type === "required_status_checks");
    status.parameters.required_status_checks =
      status.parameters.required_status_checks.filter(row => row.context !== check);
    const report = evaluate(policy);
    assert.equal(report.ok, false, "should reject " + check);
    assert.ok(report.results.some(row => !row.ok && row.name === "Required status check: " + check));
  }
  const wrong = full();
  wrong.rules.find(row => row.type === "required_status_checks")
    .parameters.required_status_checks =
    [{ context: "CI" }, { context: "Integrated platform acceptance" }];
  assert.equal(evaluate(wrong).ok, false);
});

test("policy applies multiple active rulesets without losing combined protections", () => {
  const p = full();
  const status = p.rules.pop();
  const extra = { ...full(), name: "Required checks", rules: [status] };
  assert.equal(evaluate(p, extra).ok, true);
});

test("documented solo-maintainer exception is explicit rather than silently passing", () => {
  const p = full();
  p.rules.find(row => row.type === "pull_request").parameters.required_approving_review_count = 0;
  const defaultReport = evaluate(p);
  assert.equal(defaultReport.ok, false);
  const exception = evaluateMainProtection({ branchProtected: true, rulesets: [p], minimumApprovals: 0 });
  assert.equal(exception.ok, true);
  for (const wrong of [-1, 7, 1.2]) {
    assert.throws(() => evaluateMainProtection({ branchProtected: true, rulesets: [p], minimumApprovals: wrong }));
  }
});
