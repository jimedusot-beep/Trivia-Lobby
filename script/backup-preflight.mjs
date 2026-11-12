/**
 * PR A: offline-only backup policy. No dependency imports, database access,
 * provider API calls, or real production upload authorization.
 *
 * Deliberately leave LIVE_UPLOADS_PERMITTED false in this PR: account caps,
 * lifecycle policy, and measured bills cannot be proven by self-asserted flags.
 */
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const LIVE_UPLOADS_PERMITTED = false;
const REASONS = Object.freeze({
  DRY_RUN_ONLY: 'Dry-run validated; production access was not requested.',
  INVALID_MODE: 'Unknown backup mode; production is denied.',
  UNAUTHORIZED_EVENT: 'Production backup is not authorized for this event.',
  UNAUTHORIZED_BRANCH: 'Production backup requires the main branch.',
  MISSING_CONFIRMATION: 'Manual production confirmation is absent or invalid.',
  PRODUCTION_DISABLED: 'Scheduled production backups are disabled.',
  RECOVERY_NOT_VERIFIED: 'The isolated recovery prerequisite has not passed.',
  PRODUCTION_UNAPPROVED: 'Production execution has not been independently approved.',
  DESTINATION_UNAPPROVED: 'The independent recovery destination is not approved.',
  RETENTION_UNVERIFIED: 'The bucket lifecycle and retention are not verified.',
  COST_EXPOSURE_UNKNOWN: 'The verified no-charge policy or egress capacity is missing.',
  CAPACITY_UNKNOWN: 'Measured capacity and the proposed budget must be finite safe nonnegative integers.',
  COST_LIMIT_EXCEEDED: 'Proposed usage exceeds the approved storage or download budget.',
  LIVE_UPLOAD_DISABLED: 'PR A deliberately disables real upload; later changes require a separate approval and review.',
});
const deny = (mode, reasonCode, productionEligible = false) => ({allowed:false,mode,reasonCode,productionEligible,summary:REASONS[reasonCode]});
const validInteger = (v,{allowZero = false}={}) => {
  if (!/^(0|[1-9]\d*)$/.test(String(v ?? ''))) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && (allowZero ? n >= 0 : n > 0) ? n : null;
};

export function evaluateBackupPolicy(input = {}) {
  const mode = input.mode === undefined || input.mode === '' ? 'dry-run' : input.mode;
  if (!['dry-run','production'].includes(mode)) return deny(mode,'INVALID_MODE');
  if (mode === 'dry-run') return {allowed:true,mode,reasonCode:'DRY_RUN_ONLY',productionEligible:false,summary:REASONS.DRY_RUN_ONLY};
  if (!['workflow_dispatch','schedule'].includes(input.eventName)) return deny(mode,'UNAUTHORIZED_EVENT');
  if (input.ref !== 'refs/heads/main') return deny(mode,'UNAUTHORIZED_BRANCH');
  if (input.eventName === 'workflow_dispatch' && input.confirmation !== 'AUTHORIZE_PRODUCTION_BACKUP') return deny(mode,'MISSING_CONFIRMATION');
  if (input.eventName === 'schedule' && input.backupsEnabled !== 'true') return deny(mode,'PRODUCTION_DISABLED');
  if (input.recoveryResult !== 'success') return deny(mode,'RECOVERY_NOT_VERIFIED');
  if (input.productionApproved !== 'true') return deny(mode,'PRODUCTION_UNAPPROVED');
  if (input.destinationApproved !== 'true') return deny(mode,'DESTINATION_UNAPPROVED');
  if (input.lifecycleVerified !== 'true') return deny(mode,'RETENTION_UNVERIFIED');
  if (input.costPolicyVerified !== 'true') return deny(mode,'COST_EXPOSURE_UNKNOWN');

  const archive = validInteger(input.archiveMaxBytes);
  const used = validInteger(input.currentUsedBytes,{allowZero:true});
  const retention = validInteger(input.retentionDays);
  const buffer = validInteger(input.expiryBufferDays,{allowZero:true});
  const storageBudget = validInteger(input.storageBudgetBytes);
  if ([archive,used,retention,buffer,storageBudget].includes(null) || retention > 365 || buffer > 30)
    return deny(mode,'CAPACITY_UNKNOWN');

  const projectedStorage = BigInt(used) + BigInt(archive) * (BigInt(retention) + BigInt(buffer));
  if (projectedStorage > BigInt(storageBudget)) return deny(mode,'COST_LIMIT_EXCEEDED');
  const monthlyDownload = validInteger(input.projectedMonthlyDownloadBytes,{allowZero:true});
  const downloadBudget = validInteger(input.downloadBudgetBytes);
  if (monthlyDownload === null || downloadBudget === null) return deny(mode,'COST_EXPOSURE_UNKNOWN');
  if (BigInt(monthlyDownload) > BigInt(downloadBudget)) return deny(mode,'COST_LIMIT_EXCEEDED');

  // Self-reported measurements and flags do not establish $0 vendor billing.
  // The real upload remains blocked until bounded execution and enforceable
  // provider-side safeguards are independently reviewed in a later PR.
  if (!LIVE_UPLOADS_PERMITTED) return deny(mode,'LIVE_UPLOAD_DISABLED',true);
  return deny(mode,'LIVE_UPLOAD_DISABLED',true);
}

function runCli() {
  const e = process.env;
  const result = evaluateBackupPolicy({
    mode: e.BACKUP_REQUEST_MODE, eventName:e.GITHUB_EVENT_NAME, ref:e.GITHUB_REF,
    confirmation:e.BACKUP_MANUAL_CONFIRMATION, backupsEnabled:e.BACKUPS_ENABLED,
    recoveryResult:e.RECOVERY_JOB_RESULT, productionApproved:e.BACKUP_PRODUCTION_APPROVED,
    destinationApproved:e.BACKUP_DESTINATION_APPROVED, lifecycleVerified:e.BACKUP_LIFECYCLE_VERIFIED,
    costPolicyVerified:e.BACKUP_NO_CHARGE_VERIFIED, archiveMaxBytes:e.BACKUP_ARCHIVE_MAX_BYTES,
    currentUsedBytes:e.BACKUP_ACCOUNT_USED_BYTES, retentionDays:e.BACKUP_RETENTION_DAYS,
    expiryBufferDays:e.BACKUP_EXPIRY_BUFFER_DAYS, storageBudgetBytes:e.BACKUP_STORAGE_BUDGET_BYTES,
    projectedMonthlyDownloadBytes:e.BACKUP_MONTHLY_DOWNLOAD_BYTES,
    downloadBudgetBytes:e.BACKUP_DOWNLOAD_BUDGET_BYTES,
  });
  console.log('Backup preflight: '+result.reasonCode+'. '+result.summary);
  if (e.GITHUB_OUTPUT) appendFileSync(e.GITHUB_OUTPUT,'authorized='+(result.allowed && result.mode === 'production' ? 'true' : 'false')+'\n');
  if (e.GITHUB_STEP_SUMMARY) appendFileSync(e.GITHUB_STEP_SUMMARY,'## Backup safety preflight\n\n'+result.reasonCode+': '+result.summary+'\n\nNo provider, production database or external service was contacted by this preflight.\n');
  if (!result.allowed) process.exitCode=1;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) runCli();
