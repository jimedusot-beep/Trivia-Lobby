import test from "node:test";
import assert from "node:assert/strict";
import { isNeonStorageEndpoint } from "./object-storage";

test("Neon S3 branch endpoints are identified without trusting lookalike domains",()=>{
  assert.equal(isNeonStorageEndpoint("https://br-example.storage.c-2.us-east-2.aws.neon.tech"),true);
  assert.equal(isNeonStorageEndpoint("https://br-example.storage.c-1.us-east-1.aws.neon.tech"),true);
  assert.equal(isNeonStorageEndpoint("https://aws.neon.tech"),false);
  assert.equal(isNeonStorageEndpoint("https://br.storage.aws.neon.tech.evil.example"),false);
  assert.equal(isNeonStorageEndpoint("https://s3.us-east-1.amazonaws.com"),false);
  assert.equal(isNeonStorageEndpoint("https://abc.r2.cloudflarestorage.com"),false);
  assert.equal(isNeonStorageEndpoint("not a valid URL"),false);
  assert.equal(isNeonStorageEndpoint(""),false);
});

test("Neon production configuration requires private scoped S3 credentials and path-style access", async () => {
  const { validateProductionConfig } = await import("./production-config");
  const keys = [
    "DATABASE_URL", "PORT", "S3_BUCKET", "S3_ENDPOINT",
    "S3_FORCE_PATH_STYLE", "AWS_REGION", "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY", "S3_KMS_KEY_ID", "PRIVATE_STORAGE_DIR",
  ];
  const previous = new Map(keys.map(key => [key, process.env[key]]));
  const restore = () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  try {
    delete process.env.PRIVATE_STORAGE_DIR;
    delete process.env.S3_KMS_KEY_ID;
    Object.assign(process.env, {
      DATABASE_URL: "postgresql://fake:fake@ep-test.neon.tech/trivia?sslmode=require",
      PORT: "10000",
      S3_BUCKET: "trivia-originals",
      S3_ENDPOINT: "https://br-example.storage.c-2.us-east-2.aws.neon.tech",
      S3_FORCE_PATH_STYLE: "true",
      AWS_REGION: "us-east-2",
      AWS_ACCESS_KEY_ID: "test-only-placeholder",
      AWS_SECRET_ACCESS_KEY: "test-only-placeholder",
    });
    assert.doesNotThrow(() => validateProductionConfig());
    delete process.env.S3_FORCE_PATH_STYLE;
    assert.doesNotThrow(() => validateProductionConfig(), "Neon CLI vars should work without a manual path-style flag");
    process.env.S3_FORCE_PATH_STYLE = "true";
    delete process.env.AWS_SECRET_ACCESS_KEY;
    assert.throws(() => validateProductionConfig(), /Neon Object Storage credentials/);
    process.env.AWS_SECRET_ACCESS_KEY = "test-only-placeholder";
    process.env.S3_FORCE_PATH_STYLE = "false";
    assert.throws(() => validateProductionConfig(), /requires path-style S3 transport/);
    process.env.S3_FORCE_PATH_STYLE = "true";
    process.env.S3_KMS_KEY_ID = "test-only-misconfigured-kms";
    assert.throws(() => validateProductionConfig(), /does not support AWS KMS/);
  } finally { restore(); }
});
