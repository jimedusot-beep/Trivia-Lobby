// Read-only GitHub ruleset audit. No administration, secrets or configuration changes.
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const REQUIRED_CHECKS = Object.freeze([
  "checks",
  "production-runtime",
  "postgres-and-browsers (chromium)",
  "postgres-and-browsers (firefox)",
  "postgres-and-browsers (webkit)"
]);

const scopedToDefaultBranch = ruleSet => {
  const refs = ruleSet?.conditions?.ref_name;
  const includes = refs?.include ?? [];
  const excludes = refs?.exclude ?? [];
  return ruleSet?.enforcement === "active" &&
    ruleSet?.target === "branch" &&
    (includes.includes("~DEFAULT_BRANCH") || includes.includes("refs/heads/main") || includes.includes("main")) &&
    !excludes.includes("~DEFAULT_BRANCH") && !excludes.includes("refs/heads/main") && !excludes.includes("main");
};

export function evaluateMainProtection({ branchProtected, rulesets, minimumApprovals = 1 }) {
  if (!Number.isSafeInteger(minimumApprovals) || minimumApprovals < 0 || minimumApprovals > 6) {
    throw new Error("minimumApprovals must be an integer between 0 and 6");
  }
  const applicable = rulesets.filter(scopedToDefaultBranch);
  const rules = applicable.flatMap(x => x.rules ?? []);
  const types = new Set(rules.map(x => x.type));
  const pr = rules.filter(x => x.type === "pull_request");
  const reviews = Math.max(0, ...pr.map(x => x.parameters?.required_approving_review_count ?? 0));
  const stale = pr.some(x => x.parameters?.dismiss_stale_reviews_on_push === true);
  const statuses = rules.filter(x => x.type === "required_status_checks");
  const checkNames = new Set(statuses.flatMap(x =>
    (x.parameters?.required_status_checks ?? []).map(y => y.context)));
  const strict = statuses.some(x => x.parameters?.strict_required_status_checks_policy === true);

  const results = [
    { name: "Branch reports protected", ok: branchProtected === true,
      fix: "Confirm an active branch ruleset applies to main" },
    { name: "Active ruleset targets main", ok: applicable.length > 0,
      fix: "Set enforcement to Active and target the default branch (main)" },
    { name: "Deletion blocked", ok: types.has("deletion"),
      fix: "Enable restrict deletions" },
    { name: "Force pushes blocked", ok: types.has("non_fast_forward"),
      fix: "Enable block force pushes" },
    { name: "Pull requests required", ok: pr.length > 0,
      fix: "Enable require a pull request before merging" },
    ...REQUIRED_CHECKS.map(check => ({
      name: "Required status check: " + check, ok: checkNames.has(check),
      fix: "Add exact status context " + check + " (GitHub Actions)"
    })),
    { name: "Updated branches required", ok: strict,
      fix: "Enable require branches to be up to date before merging" },
    { name: "Independent approving review", ok: reviews >= minimumApprovals,
      fix: "Require " + minimumApprovals + " approval(s) if an eligible independent reviewer exists; owner-only accounts must document exception" },
    { name: "Stale reviews dismissed on new commits", ok: minimumApprovals === 0 || stale,
      fix: "Enable dismiss stale pull request approvals when new commits are pushed" }
  ];

  return {
    ok: results.every(x => x.ok),
    applicable: applicable.map(x => x.name),
    requiredChecksObserved: [...checkNames].sort(),
    approvalsObserved: reviews,
    minimumApprovals,
    results
  };
}

async function githubGet(path) {
  const response = await fetch("https://api.github.com" + path, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "trivia-lobby-main-protection-audit",
      ...(process.env.GITHUB_TOKEN ? { Authorization: "Bearer " + process.env.GITHUB_TOKEN } : {})
    }
  });
  if (!response.ok) throw new Error("GitHub metadata read failed (HTTP " + response.status + ")");
  return response.json();
}

async function runAudit() {
  const repo = process.env.GITHUB_REPOSITORY || "";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("GITHUB_REPOSITORY must be owner/repo");
  const minimumApprovals = Number(process.env.MIN_APPROVALS ?? "1");
  const base = "/repos/" + repo;
  const [branch, list] = await Promise.all([
    githubGet(base + "/branches/main"),
    githubGet(base + "/rulesets?per_page=100")
  ]);
  const details = await Promise.all(
    list.filter(x => x.target === "branch" && x.enforcement === "active")
      .map(x => githubGet(base + "/rulesets/" + x.id))
  );
  const report = evaluateMainProtection({ branchProtected: branch.protected, rulesets: details, minimumApprovals });
  const rows = report.results.map(x =>
    "| " + (x.ok ? "Pass" : "Needs owner action") + " | " + x.name + " | " + (x.ok ? "None" : x.fix) + " |");
  const summary = "## Trivia Lobby main branch protection audit\n\n" +
    "Read-only inspection of " + repo + " at main " + branch.commit.sha.slice(0, 12) + ".\n\n" +
    "Applicable rulesets: " + (report.applicable.join(", ") || "none") + ".\n\n" +
    "| Result | Control | Required action |\n| --- | --- | --- |\n" + rows.join("\n") + "\n\n" +
    "**No repository settings were modified.** Rule configuration is not proof of an unprivileged push being blocked; test enforcement separately.\n";
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAudit().catch(error => {
    console.error("::error title=Ruleset audit unavailable::" + error.message);
    process.exitCode = 1;
  });
}
