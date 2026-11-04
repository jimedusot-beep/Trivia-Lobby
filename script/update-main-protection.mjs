// Owner-executed, opt-in updater for existing Trivia Lobby main ruleset.
// Dry-run by default; no PAT, token, or repository setting is committed here.
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { evaluateMainProtection, REQUIRED_CHECKS } from "./audit-main-protection.mjs";

const RULESET_ID = 26269964;
const REPOSITORY = "jimedusot-beep/Trivia-Lobby";
const RESOURCE = "repos/" + REPOSITORY + "/rulesets/" + RULESET_ID;

export function prepareMainProtectionUpdate(snapshot) {
  if (snapshot?.id !== RULESET_ID || snapshot?.source_type !== "Repository" ||
      snapshot?.source !== REPOSITORY || snapshot?.name !== "Protect Trivia Lobby main" ||
      snapshot?.target !== "branch" || snapshot?.enforcement !== "active" ||
      !snapshot?.conditions?.ref_name?.include?.includes("~DEFAULT_BRANCH") ||
      snapshot?.conditions?.ref_name?.exclude?.includes("~DEFAULT_BRANCH")) {
    throw new Error("Unexpected ruleset target or identity; inspect GitHub Settings manually");
  }
  if (!Array.isArray(snapshot.rules) || !Array.isArray(snapshot.bypass_actors)) {
    throw new Error("Incomplete ruleset response; refusing to replace policy");
  }
  const prRules = snapshot.rules.filter(rule => rule.type === "pull_request");
  const checkRules = snapshot.rules.filter(rule => rule.type === "required_status_checks");
  if (prRules.length !== 1 || checkRules.length !== 1 ||
      prRules[0].parameters?.required_approving_review_count !== 0) {
    throw new Error("Expected one PR rule with the solo-maintainer 0-approval policy");
  }
  const status = checkRules[0], existing = status.parameters?.required_status_checks;
  if (!Array.isArray(existing) || existing.length === 0 ||
      !existing.every(row => typeof row.context === "string" && Number.isInteger(row.integration_id))) {
    throw new Error("Missing or malformed required checks; refusing to replace policy");
  }
  if (new Set(existing.map(row => row.context)).size !== existing.length) {
    throw new Error("Duplicate check contexts; inspect GitHub Settings before updating");
  }
  const baseline = existing.find(row => row.context === "production-runtime");
  if (!baseline) throw new Error("Existing production-runtime check is missing");
  const newChecks = [...existing.map(row => ({ ...row }))];
  for (const context of REQUIRED_CHECKS) {
    if (!newChecks.some(row => row.context === context)) {
      newChecks.push({ context, integration_id: baseline.integration_id });
    }
  }
  const rules = snapshot.rules.map(rule => rule.type !== "required_status_checks"
    ? structuredClone(rule)
    : { ...structuredClone(rule), parameters: {
        ...structuredClone(rule.parameters),
        strict_required_status_checks_policy: true,
        required_status_checks: newChecks,
      } });
  return {
    name: snapshot.name,
    target: snapshot.target,
    enforcement: snapshot.enforcement,
    conditions: structuredClone(snapshot.conditions),
    bypass_actors: structuredClone(snapshot.bypass_actors),
    rules,
  };
}

function ghApi(args, input) {
  const out = spawnSync("gh", ["api", ...args], {
    input, encoding: "utf8", timeout: 20000, maxBuffer: 2_000_000,
  });
  if (out.error || out.status !== 0) {
    throw new Error("GitHub CLI request failed; check gh auth status, repository admin access and API response privately");
  }
  try { return JSON.parse(out.stdout); }
  catch { throw new Error("GitHub CLI returned invalid JSON"); }
}

async function main() {
  const flags = process.argv.slice(2);
  const apply = flags.includes("--apply");
  if (flags.some(flag => !["--apply", "--confirm=26269964"].includes(flag)) ||
      (apply && !flags.includes("--confirm=26269964")) ||
      (!apply && flags.includes("--confirm=26269964"))) {
    throw new Error("Use no arguments for a dry run, or --apply --confirm=26269964 for the owner-approved update");
  }
  const before = ghApi([RESOURCE]);
  const proposed = prepareMainProtectionUpdate(before);
  const previous = before.rules.find(rule => rule.type === "required_status_checks").parameters;
  const next = proposed.rules.find(rule => rule.type === "required_status_checks").parameters;
  const added = next.required_status_checks.filter(row =>
    !previous.required_status_checks.some(existing => existing.context === row.context)).map(row => row.context);
  console.log("Existing ruleset:", RULESET_ID, before.name);
  console.log("Newly required contexts:", added.length ? added.join(", ") : "(none)");
  console.log("Strict up-to-date branches:", previous.strict_required_status_checks_policy, "->", true);
  console.log("Required reviews: 0 (unchanged); deletion, force-push and bypass rules preserved");
  if (!apply) {
    console.log("DRY RUN ONLY. Nothing changed. Run --apply --confirm=26269964 to save as the repository owner.");
    return;
  }
  ghApi([RESOURCE, "--method", "PUT", "--input", "-"], JSON.stringify(proposed));
  const [after, branch] = [ghApi([RESOURCE]), ghApi(["repos/" + REPOSITORY + "/branches/main"])];
  const report = evaluateMainProtection({
    branchProtected: branch.protected, rulesets: [after], minimumApprovals: 0,
  });
  if (!report.ok) throw new Error("Ruleset updated but failed read-back audit; inspect settings immediately");
  console.log("Ruleset saved and read-back audit passed; verify stale and failing PR enforcement separately.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error("::error::" + error.message); process.exitCode = 1; });
}
