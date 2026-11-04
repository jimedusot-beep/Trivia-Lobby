// Scheduled workflow reporting: distinguish a fixture recovery pass from a
// real encrypted offsite archive. No credentials, bucket names, or user data.
import { appendFileSync } from "node:fs";
import { pingBackupHeartbeat } from "./backup-heartbeat.mjs";

const enabled = process.env.BACKUPS_ENABLED === "true";
const recovery = process.env.RECOVERY_JOB_RESULT || "unknown";
const backup = process.env.BACKUP_JOB_RESULT || "unknown";
const verified = enabled && recovery === "success" && backup === "success";
const reason = !enabled
  ? "The repository BACKUPS_ENABLED variable is not true; the production backup job may have been skipped."
  : recovery !== "success"
    ? "The disposable recovery prerequisite did not pass; check its independent workflow logs."
    : backup !== "success"
      ? "The production encrypted offsite backup job did not succeed (status: " + backup + ")."
      : "Both the disposable recovery drill and production offsite backup job succeeded.";

// Never signal success for skipped, failed or cancelled backups. The heartbeat
// secret is only injected into this scheduled audit job, never PRs or fixture jobs.
let heartbeat = "unconfigured";
if (verified && process.env.BACKUP_HEARTBEAT_URL) {
  try { await pingBackupHeartbeat(process.env.BACKUP_HEARTBEAT_URL); heartbeat = "delivered"; }
  catch { heartbeat = "failed"; }
}
const heartbeatNote = heartbeat === "delivered"
  ? "An external backup-success heartbeat was delivered. The provider must independently alert on a missed schedule."
  : heartbeat === "failed"
    ? "The actual backup succeeded but external heartbeat delivery FAILED. Check the private monitor settings and destination."
    : "External missed-schedule monitoring is NOT configured; set the BACKUP_HEARTBEAT_URL secret and independently test alert delivery before closing issue #48.";

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    (!verified ? "## Scheduled offsite backup NOT VERIFIED\n" :
      heartbeat === "failed" ? "## Backup succeeded; heartbeat FAILED\n" :
        "## Scheduled offsite backup job succeeded\n") +
    "\n" + reason + "\n\n" + heartbeatNote + "\n\n" +
    "This monitor evaluates workflow job outcomes only. A provider-independent restore " +
    "of the actual backup, original-file hash comparison, retention policy and a " +
    "tested missed-schedule alert are separately required before closing issue #48.\n");
}

if (!verified) {
  console.error("::error title=Production offsite backup not verified::" + reason);
  process.exitCode = 1;
} else if (heartbeat === "failed") {
  console.error("::error title=External backup heartbeat failed::" + heartbeatNote);
  process.exitCode = 1;
} else {
  console.log("Scheduled offsite backup job and recovery prerequisite completed successfully.");
  if (heartbeat === "unconfigured") console.warn("::warning title=Missed-schedule alerts not configured::" + heartbeatNote);
  else console.log("External backup heartbeat delivered (destination withheld).");
}
