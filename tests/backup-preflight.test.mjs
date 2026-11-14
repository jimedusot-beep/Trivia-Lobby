import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { evaluateBackupPolicy } from '../script/backup-preflight.mjs';

const ready = {
  mode: 'production', eventName: 'workflow_dispatch', ref: 'refs/heads/main',
  confirmation: 'AUTHORIZE_PRODUCTION_BACKUP', recoveryResult: 'success',
  productionApproved: 'true', destinationApproved: 'true',
  lifecycleVerified: 'true', costPolicyVerified: 'true',
  archiveMaxBytes: '1000', currentUsedBytes: '2000',
  retentionDays: '7', expiryBufferDays: '2',
  storageBudgetBytes: '20000',
  projectedMonthlyDownloadBytes: '3000', downloadBudgetBytes: '10000'
};
const check = (overrides={}) => evaluateBackupPolicy({...ready,...overrides});

test('T01: omitted mode is safe dry-run, never production authorized', () => {
  const r = evaluateBackupPolicy({eventName:'workflow_dispatch',ref:'refs/heads/main'});
  assert.equal(r.mode,'dry-run'); assert.equal(r.allowed,true); assert.equal(r.productionEligible,false);
});
test('T02: invalid mode denied', () => assert.equal(check({mode:'upload'}).reasonCode,'INVALID_MODE'));
test('T03: pull request cannot authorize production', () => assert.equal(check({eventName:'pull_request'}).reasonCode,'UNAUTHORIZED_EVENT'));
test('T04: non-main ref cannot authorize production', () => assert.equal(check({ref:'refs/heads/feature'}).reasonCode,'UNAUTHORIZED_BRANCH'));
test('T05: manual confirmation required exactly', () => {
  for (const confirmation of ['', 'yes', 'authorize_production_backup']) assert.equal(check({confirmation}).reasonCode,'MISSING_CONFIRMATION');
});
test('T06: scheduled backup disabled blocks authorization', () => {
  for (const backupsEnabled of ['', 'false', 'TRUE']) assert.equal(check({eventName:'schedule',confirmation:'',backupsEnabled}).reasonCode,'PRODUCTION_DISABLED');
});
test('T07: successful disposable recovery required', () => assert.equal(check({recoveryResult:'skipped'}).reasonCode,'RECOVERY_NOT_VERIFIED'));
test('T08: production and independent destination approvals required', () => {
  assert.equal(check({productionApproved:''}).reasonCode,'PRODUCTION_UNAPPROVED');
  assert.equal(check({destinationApproved:''}).reasonCode,'DESTINATION_UNAPPROVED');
});
test('T09: unknown or invalid capacity fails closed', () => {
  for (const archiveMaxBytes of ['', 'NaN', '-1', '0', '2.5', '9999999999999999999999999']) assert.equal(check({archiveMaxBytes}).reasonCode,'CAPACITY_UNKNOWN');
});
test('T10: retention must be explicit and verified', () => {
  assert.equal(check({lifecycleVerified:''}).reasonCode,'RETENTION_UNVERIFIED');
  assert.equal(check({retentionDays:'0'}).reasonCode,'CAPACITY_UNKNOWN');
});
test('T11: storage projection includes expiry delay and rejects excess', () => {
  assert.equal(check({storageBudgetBytes:'10500',archiveMaxBytes:'1000',currentUsedBytes:'2000',retentionDays:'7',expiryBufferDays:'2'}).reasonCode,'COST_LIMIT_EXCEEDED');
});
test('T12: download cost and provider controls remain explicit unknowns', () => {
  assert.equal(check({costPolicyVerified:''}).reasonCode,'COST_EXPOSURE_UNKNOWN');
  assert.equal(check({projectedMonthlyDownloadBytes:''}).reasonCode,'COST_EXPOSURE_UNKNOWN');
  assert.equal(check({downloadBudgetBytes:'2000'}).reasonCode,'COST_LIMIT_EXCEEDED');
});
test('T13: complete operator attestation is policy-ready but cannot authorize real uploads in PR A', () => {
  const r=check(); assert.equal(r.productionEligible,true);assert.equal(r.allowed,false);assert.equal(r.reasonCode,'LIVE_UPLOAD_DISABLED');
});
test('T14: pure evaluation never invokes injected network/database capabilities', () => {
  let calls=0;
  const hostile = { fetch: ()=>{calls++;throw Error('network');}, query:()=>{calls++;throw Error('database');} };
  const r=evaluateBackupPolicy({...ready,...hostile});
  assert.equal(r.reasonCode,'LIVE_UPLOAD_DISABLED');assert.equal(calls,0);
});
test('T15: CLI denied production returns nonzero and never reveals secrets', () => {
  const token='very-secret-for-test-should-not-appear';
  const child=spawnSync(process.execPath,['script/backup-preflight.mjs'],{
    cwd:process.cwd(),encoding:'utf8',env:{...process.env,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',BACKUP_REQUEST_MODE:'production',BACKUP_MANUAL_CONFIRMATION:'',BACKUP_AWS_SECRET_ACCESS_KEY:token}});
  assert.equal(child.status,1);assert.doesNotMatch((child.stdout||'')+(child.stderr||''),new RegExp(token));
});
test('T16: valid scheduled production policy remains upload-disabled, even if operator flags true', () => {
  const r=check({eventName:'schedule',confirmation:'',backupsEnabled:'true'});
  assert.equal(r.reasonCode,'LIVE_UPLOAD_DISABLED'); assert.equal(r.allowed,false);
});
