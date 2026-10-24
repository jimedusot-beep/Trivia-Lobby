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
