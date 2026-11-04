import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_CHECKS, evaluateMainProtection } from "../script/audit-main-protection.mjs";
import { prepareMainProtectionUpdate } from "../script/update-main-protection.mjs";

const snapshot = () => ({
  id: 26269964, source_type: "Repository", source: "jimedusot-beep/Trivia-Lobby",
  name: "Protect Trivia Lobby main", target: "branch", enforcement: "active",
  bypass_actors: [],
  conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
  rules: [
    {type:"deletion"}, {type:"non_fast_forward"}, {type:"creation"},
    {type:"pull_request", parameters:{required_approving_review_count:0,
      dismiss_stale_reviews_on_push:false, allowed_merge_methods:["merge","squash","rebase"]}},
    {type:"required_status_checks", parameters:{strict_required_status_checks_policy:false,
      do_not_enforce_on_create:false, required_status_checks:[
        "production-runtime","postgres-and-browsers (chromium)",
        "postgres-and-browsers (webkit)","postgres-and-browsers (firefox)"
      ].map(context=>({context,integration_id:15368}))}}
  ],
});

test("prepares eight exact checks, strict freshness, and preserves solo/restriction rules", () => {
  const original = snapshot();
  const updated = prepareMainProtectionUpdate(original);
  const check = updated.rules.find(x=>x.type==="required_status_checks").parameters;
  assert.equal(check.strict_required_status_checks_policy,true);
  assert.deepEqual(new Set(check.required_status_checks.map(x=>x.context)),new Set(REQUIRED_CHECKS));
  assert.ok(check.required_status_checks.every(x=>x.integration_id===15368));
  assert.equal(updated.rules.find(x=>x.type==="pull_request").parameters.required_approving_review_count,0);
  assert.ok(updated.rules.some(x=>x.type==="deletion"));
  assert.ok(updated.rules.some(x=>x.type==="non_fast_forward"));
  assert.ok(updated.rules.some(x=>x.type==="creation"));
  assert.equal(original.rules.find(x=>x.type==="required_status_checks").parameters.strict_required_status_checks_policy,false);
  const report = evaluateMainProtection({
    branchProtected:true,rulesets:[{...updated,id:26269964}],minimumApprovals:0,
  });
  assert.equal(report.ok,true);
});

test("preserves existing future policy additions and handles reruns idempotently", () => {
  const original = snapshot();
  original.bypass_actors = [{actor_id:12,actor_type:"RepositoryRole",bypass_mode:"pull_request"}];
  original.rules.push({type:"required_signatures"});
  const updated = prepareMainProtectionUpdate(original);
  assert.deepEqual(updated.bypass_actors,original.bypass_actors);
  assert.ok(updated.rules.some(x=>x.type==="required_signatures"));
  const again = prepareMainProtectionUpdate({...original,...updated});
  assert.deepEqual(again,updated);
});

test("refuses wrong identity, disabled rules, altered review requirement or malformed checks", () => {
  const cases = [
    s=>{s.id=123;},s=>{s.source="another/repo";},s=>{s.enforcement="evaluate";},
    s=>{s.conditions.ref_name.include=["refs/heads/dev"];},
    s=>{s.rules.find(x=>x.type==="pull_request").parameters.required_approving_review_count=1;},
    s=>{s.rules.find(x=>x.type==="required_status_checks").parameters.required_status_checks=[];},
    s=>{const a=s.rules.find(x=>x.type==="required_status_checks").parameters.required_status_checks;a.push({...a[0]});},
    s=>{s.rules=s.rules.filter(x=>x.type!=="pull_request");},
  ];
  for (const change of cases) {
    const s=snapshot();change(s);
    assert.throws(()=>prepareMainProtectionUpdate(s));
  }
});
