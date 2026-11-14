import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/backups.yml',import.meta.url),'utf8');
const job=(name,next)=>{
  const start=workflow.indexOf('\n  '+name+':\n');
  assert.ok(start>=0,'missing job '+name);
  const tail=workflow.slice(start+name.length+5);
  const index=tail.search(/\n  [a-z][a-z0-9-]*:\n/);
  return index>=0?tail.slice(0,index):tail;
};
test('W01: manual dispatch offers safe dry-run default and explicit production choice',()=>{
  assert.match(workflow,/workflow_dispatch:\s*\n\s+inputs:/);
  assert.match(workflow,/mode:[\s\S]*?default: ['"]?dry-run/);
  assert.match(workflow,/options:\s*\n\s+- dry-run\s*\n\s+- production/);
  assert.match(workflow,/confirmation:/);
});
test('W02: policy gate exists, runs after disposable recovery, and receives no production secrets',()=>{
  const gate=job('backup-policy-gate');
  assert.match(gate,/needs: recovery-postgres18/);
  assert.match(gate,/node script\/backup-preflight\.mjs/);
  assert.doesNotMatch(gate,/\$\{\{\s*secrets\.|BACKUP_DATABASE_URL|SOURCE_AWS_ACCESS_KEY_ID/);
});
test('W03: production job requires successful gate and explicit production mode',()=>{
  const prod=job('backup');
  assert.match(prod,/needs: \[recovery-postgres18, backup-policy-gate\]/);
  assert.match(prod,/needs\.backup-policy-gate\.result == 'success'/);
  assert.match(prod,/inputs\.mode == 'production'/);
  assert.match(prod,/github\.event_name != 'pull_request'/);
});
test('W04: no production secrets reach dry-run, pull-request recovery, or policy gate',()=>{
  const recovery=job('recovery-postgres18');const gate=job('backup-policy-gate');
  assert.doesNotMatch(recovery,/\$\{\{\s*secrets\.|BACKUP_DATABASE_URL/);
  assert.doesNotMatch(gate,/\$\{\{\s*secrets\.|BACKUP_DATABASE_URL/);
});
test('W05: schedule audit continues to mark skipped production backup unsuccessful',()=>{
  const audit=job('scheduled-backup-audit');
  assert.match(audit,/always\(\).*github\.event_name == 'schedule'/);
  assert.match(audit,/script\/verify-scheduled-backup\.mjs/);
});
