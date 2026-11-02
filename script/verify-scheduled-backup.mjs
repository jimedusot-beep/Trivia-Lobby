// Scheduled workflow reporting: distinguish a fixture recovery pass from a
// real encrypted offsite archive. No credentials, bucket names, or user data.
import { appendFileSync } from "node:fs";

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

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    (verified ? "## Scheduled offsite backup job succeeded\n" : "## Scheduled offsite backup NOT VERIFIED\n") +
    "\n" + reason + "\n\n" +
    "This monitor evaluates workflow job outcomes only. A provider-independent restore " +
    "of the actual backup, original-file hash comparison, retention policy and a " +
    "missed-schedule alert are separately required before closing issue #48.\n");
}

if (verified) {
  console.log("Scheduled offsite backup job and recovery prerequisite completed successfully.");
} else {
  console.error("::error title=Production offsite backup not verified::" + reason);
  process.exitCode = 1;
}
