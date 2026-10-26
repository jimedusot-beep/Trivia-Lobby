import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { offsiteConfig, uploadEncryptedBackup } from "./backup-offsite";

const configured = {
  BACKUP_S3_BUCKET: "independent-recovery",
  BACKUP_AWS_REGION: "us-east-1",
  BACKUP_AWS_ACCESS_KEY_ID: "destination-test-key",
  BACKUP_AWS_SECRET_ACCESS_KEY: "destination-test-secret",
};

test("scheduled backups refuse an absent destination and incomplete credentials", () => {
  assert.equal(offsiteConfig({}), undefined, "local archive creation stays available");
  assert.throws(() => offsiteConfig({ BACKUP_REQUIRE_OFFSITE: "1" }), /BACKUP_S3_BUCKET/);
  assert.throws(() => offsiteConfig({ BACKUP_S3_BUCKET: "recovery" }), /BACKUP_AWS_ACCESS_KEY_ID/);
  assert.throws(() => offsiteConfig({ ...configured, BACKUP_AWS_SECRET_ACCESS_KEY: "" }), /BACKUP_AWS_SECRET_ACCESS_KEY/);
  assert.throws(() => offsiteConfig({ BACKUP_AWS_ACCESS_KEY_ID: "orphan" }), /BACKUP_S3_BUCKET/);
});

test("destination client ignores source endpoints, region and credentials", async () => {
  const previous = { ...process.env };
  Object.assign(process.env, {
    AWS_ENDPOINT_URL_S3: "https://source.storage.aws.neon.tech",
    AWS_ENDPOINT_URL: "https://another-source.example",
    AWS_ACCESS_KEY_ID: "source-test-key",
    AWS_SECRET_ACCESS_KEY: "source-test-secret",
    AWS_REGION: "us-east-2",
  });
  const config = offsiteConfig({ ...process.env, ...configured })!;
  let destinationHost = "";
  const client = new S3Client({ ...config.client, requestHandler: {
    async handle(request: { hostname: string; headers: Record<string, string> }) {
      destinationHost = request.hostname;
      assert.match(request.headers.authorization, /Credential=destination-test-key\//);
      return { response: { statusCode: 200, headers: {}, body: Readable.from([]) } };
    },
  } });
  try {
    assert.equal(client.config.ignoreConfiguredEndpointUrls, true);
    assert.equal(await client.config.region(), "us-east-1");
    assert.equal((await client.config.credentials()).accessKeyId, "destination-test-key");
    await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: "test.enc", Body: Buffer.from("test") }));
    assert.equal(destinationHost, "independent-recovery.s3.us-east-1.amazonaws.com");
  } finally {
    client.destroy();
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});

test("custom offsite destinations use HTTPS and cannot reuse Neon or the source bucket", () => {
  const config = offsiteConfig({ ...configured, BACKUP_S3_ENDPOINT: "https://recovery.example", BACKUP_S3_FORCE_PATH_STYLE: "true" })!;
  assert.equal(config.client.endpoint, "https://recovery.example");
  assert.equal(config.client.forcePathStyle, true);
  for (const endpoint of ["http://recovery.example", "https://user:password@recovery.example", "https://recovery.example?secret=key", "https://source.storage.aws.neon.tech"]) {
    assert.throws(() => offsiteConfig({ ...configured, BACKUP_S3_ENDPOINT: endpoint }), /offsite|HTTPS/i);
  }
  assert.throws(() => offsiteConfig({ ...configured, S3_BUCKET: configured.BACKUP_S3_BUCKET }), /source bucket/i);
  assert.throws(() => offsiteConfig({ ...configured, AWS_ACCESS_KEY_ID: configured.BACKUP_AWS_ACCESS_KEY_ID }), /separate.*credentials/i);
});

test("upload verifies the actual offsite bytes and reports an immutable recovery locator", async () => {
  const dir = await mkdtemp(join(tmpdir(), "offsite-test-"));
  const path = join(dir, "archive.enc"), bytes = Buffer.from("already encrypted fixture");
  await writeFile(path, bytes);
  const calls: (PutObjectCommand | GetObjectCommand)[] = [];
  const send = async (command: PutObjectCommand | GetObjectCommand) => {
    calls.push(command);
    if (command instanceof PutObjectCommand) {
      const chunks: Buffer[] = [];
      for await (const chunk of command.input.Body as Readable) chunks.push(Buffer.from(chunk));
      assert.deepEqual(Buffer.concat(chunks), bytes);
      assert.equal(command.input.IfNoneMatch, "*");
      return {};
    }
    return { Body: Readable.from([bytes]), ContentLength: bytes.length };
  };
  try {
    const result = await uploadEncryptedBackup(path, offsiteConfig(configured)!, { send });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].input.Key, calls[1].input.Key);
    assert.match(result.key, /^trivia-backups\/.+\.enc$/);
    assert.equal(result.sha256, createHash("sha256").update(bytes).digest("hex"));
    assert.equal(result.size, bytes.length);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("missing, truncated and corrupted offsite readback fails the backup", async () => {
  const dir = await mkdtemp(join(tmpdir(), "offsite-corruption-"));
  const path = join(dir, "archive.enc"), bytes = Buffer.from("encrypted fixture bytes");
  await writeFile(path, bytes);
  try {
    for (const returned of [undefined, Buffer.alloc(0), Buffer.alloc(bytes.length, 88), Buffer.concat([bytes, Buffer.from("extra")])]) {
      const send = async (command: PutObjectCommand | GetObjectCommand) => {
        if (command instanceof PutObjectCommand) {
          for await (const _chunk of command.input.Body as Readable) { /* consume the request stream */ }
          return {};
        }
        return { Body: returned && Readable.from([returned]) };
      };
      await assert.rejects(uploadEncryptedBackup(path, offsiteConfig(configured)!, { send }), /Offsite.*verification/);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
