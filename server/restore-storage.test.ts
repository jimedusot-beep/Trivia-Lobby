import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isolatedRestoreEnvironment } from "./restore-storage";

test("restore requires an explicit empty local destination and strips inherited Neon source settings", async () => {
  const root = await mkdtemp(join(tmpdir(), "restore-isolation-"));
  try {
    await assert.rejects(isolatedRestoreEnvironment({ PRIVATE_STORAGE_DIR: root }), /RESTORE_PRIVATE_STORAGE_DIR/);
    const env = await isolatedRestoreEnvironment({
      RESTORE_PRIVATE_STORAGE_DIR: root,
      AWS_ENDPOINT_URL_S3: "https://source.storage.aws.neon.tech", AWS_ENDPOINT_URL: "https://source.example",
      S3_BUCKET: "uploads", S3_ENDPOINT: "https://source.storage.aws.neon.tech", S3_KMS_KEY_ID: "source-kms",
      AWS_ACCESS_KEY_ID: "source-key", AWS_SECRET_ACCESS_KEY: "source-secret", AWS_SESSION_TOKEN: "source-token",
    });
    assert.equal(env.PRIVATE_STORAGE_DIR, root);
    for (const key of ["S3_BUCKET", "S3_ENDPOINT", "AWS_ENDPOINT_URL_S3", "AWS_ENDPOINT_URL", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "S3_KMS_KEY_ID"]) {
      assert.equal(env[key], undefined, key + " must never configure a restore");
    }
    await writeFile(join(root, "existing.blob"), "irreplaceable original");
    await assert.rejects(isolatedRestoreEnvironment({ RESTORE_PRIVATE_STORAGE_DIR: root }), /empty/);
    assert.equal(await readFile(join(root, "existing.blob"), "utf8"), "irreplaceable original");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("restore rejects the source directory even through a symlink", async () => {
  const root = await mkdtemp(join(tmpdir(), "restore-source-"));
  try {
    const source = join(root, "source"), alias = join(root, "alias");
    await mkdir(source); await symlink(source, alias);
    await assert.rejects(isolatedRestoreEnvironment({ PRIVATE_STORAGE_DIR: source, RESTORE_PRIVATE_STORAGE_DIR: source }), /source/);
    await assert.rejects(isolatedRestoreEnvironment({ PRIVATE_STORAGE_DIR: source, RESTORE_PRIVATE_STORAGE_DIR: alias }), /source/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
