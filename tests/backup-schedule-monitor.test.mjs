import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Exercise the exact script run by the scheduled GitHub Actions guard job.
// No production database, S3 account, credentials or live network used.
function probe({ enabled, recovery, backup }) {
  const folder = mkdtempSync(join(tmpdir(), "trivia-backup-guard-"));
  const summary = join(folder, "summary.md");
  try {
    const result = spawnSync(process.execPath, ["script/verify-scheduled-backup.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        GITHUB_STEP_SUMMARY: summary,
        BACKUPS_ENABLED: enabled,
        RECOVERY_JOB_RESULT: recovery,
        BACKUP_JOB_RESULT: backup,
      },
      encoding: "utf8",
    });
    if (result.error) throw result.error;
    return { status: result.status, summary: readFileSync(summary, "utf8"), stderr: result.stderr, stdout: result.stdout };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

test("the scheduled backup monitor passes only after a genuine offsite job success", () => {
  const ok = probe({ enabled: "true", recovery: "success", backup: "success" });
  assert.equal(ok.status, 0);
  assert.match(ok.summary, /backup job succeeded/);
  assert.doesNotMatch(ok.summary, /NOT VERIFIED/);
});

test("skipped scheduled production backups cannot appear green after a fixture restore", () => {
  for (const enabled of ["", "false", "TRUE"]) {
    const result = probe({ enabled, recovery: "success", backup: "skipped" });
    assert.equal(result.status, 1);
    assert.match(result.summary, /NOT VERIFIED/);
    assert.match(result.stderr, /BACKUPS_ENABLED/);
  }
});

test("failed, cancelled, or missing offsite results fail the monitor", () => {
  for (const backup of ["failure", "cancelled", "timed_out", "unknown", "skipped", ""]) {
    const result = probe({ enabled: "true", recovery: "success", backup });
    assert.equal(result.status, 1, backup);
    assert.match(result.summary, /NOT VERIFIED/);
  }
  const missingPrerequisite = probe({ enabled: "true", recovery: "failure", backup: "success" });
  assert.equal(missingPrerequisite.status, 1);
  assert.match(missingPrerequisite.summary, /recovery prerequisite/);
});
