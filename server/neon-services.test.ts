import test from "node:test";
import assert from "node:assert/strict";
import { privateBucketName, isNeonStorageEndpoint } from "./object-storage";
import {
  isNeonAiEnabled, neonAiChatUrl, generateNeonStudyCards, verifyNeonAiGateway,
} from "./neon-ai-gateway";

const env = (): NodeJS.ProcessEnv => ({
  ENABLE_PAID_NEON_AI_GATEWAY: "true",
  NEON_AI_GATEWAY_BASE_URL: "https://br-production-api.ai.us-east-2.aws.neon.tech",
  NEON_AI_GATEWAY_TOKEN: "test-only-never-real-credential",
  NEON_AI_GATEWAY_MODEL: "test-fake-model",
});

test("Neon CLI storage endpoint and bucket auto-detection works without explicit S3 aliases", () => {
  const old = { S3_BUCKET: process.env.S3_BUCKET, S3_ENDPOINT: process.env.S3_ENDPOINT,
    AWS_ENDPOINT_URL_S3: process.env.AWS_ENDPOINT_URL_S3 };
  try {
    delete process.env.S3_BUCKET;
    delete process.env.S3_ENDPOINT;
    process.env.AWS_ENDPOINT_URL_S3 = "https://br-abc.storage.c-2.us-east-2.aws.neon.tech";
    assert.equal(isNeonStorageEndpoint(), true);
    assert.equal(privateBucketName(), "uploads");
    process.env.S3_BUCKET = "existing-private-bucket";
    assert.equal(privateBucketName(), "existing-private-bucket");
    process.env.AWS_ENDPOINT_URL_S3 = "https://br-abc.storage.c-2.us-east-2.aws.neon.tech.evil.example";
    delete process.env.S3_BUCKET;
    assert.equal(isNeonStorageEndpoint(), false);
    assert.equal(privateBucketName(), undefined);
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("Neon AI stays disabled by default, and requires an explicit paid opt-in and model", async () => {
  assert.equal(isNeonAiEnabled({}), false);
  assert.equal(isNeonAiEnabled({ ...env(), ENABLE_PAID_NEON_AI_GATEWAY: "false" }), false);
  assert.equal(isNeonAiEnabled({ ...env(), NEON_AI_GATEWAY_MODEL: undefined }), false);
  assert.equal(await verifyNeonAiGateway({}), "disabled");
  assert.equal(isNeonAiEnabled(env()), true);
});

test("Neon AI host validation rejects attacker endpoints and misleading paths", () => {
  assert.equal(neonAiChatUrl(env()).pathname, "/v1/chat/completions");
  for (const url of [
    "http://br-production-api.ai.us-east-2.aws.neon.tech",
    "https://br-production-api.ai.us-east-2.aws.neon.tech.evil.example",
    "https://evil.example",
    "https://br-production-api.ai.us-east-2.aws.neon.tech/redirect",
    "https://user:secret@br-production-api.ai.us-east-2.aws.neon.tech",
  ]) {
    assert.throws(() => neonAiChatUrl({ ...env(), NEON_AI_GATEWAY_BASE_URL: url }), /trusted HTTPS branch host/);
  }
});

test("Neon AI source requests are private, bounded and parsed for evidence checking", async () => {
  let hit = 0;
  const response = JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      cards: [{ front: "What is a star?", back: "A luminous sphere of plasma",
        evidence: "A star is a luminous sphere of plasma." }],
    }) } }],
  });
  const fetchMock = async (input: URL | RequestInfo, init?: RequestInit) => {
    hit++;
    assert.equal(new URL(String(input)).pathname, "/v1/chat/completions");
    assert.equal(init?.redirect, "error");
    assert.equal((init?.headers as Record<string,string>).Authorization, "Bearer test-only-never-real-credential");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "test-fake-model");
    assert.equal(body.messages[1].role, "user");
    return new Response(response, { status: 200, headers: { "content-type": "application/json" } });
  };
  const result = await generateNeonStudyCards(
    { title: "Stars", body: "A star is a luminous sphere of plasma." }, env(), fetchMock as typeof fetch,
  );
  assert.equal(hit, 1);
  assert.equal((result as {cards:Array<{evidence:string}>}).cards[0].evidence, "A star is a luminous sphere of plasma.");
});

test("Neon gateway model discovery checks authentication without submitting an inference request", async () => {
  let requests = 0;
  const mock = async (input: URL | RequestInfo, init?: RequestInit) => {
    requests++;
    assert.equal(new URL(String(input)).pathname, "/v1/models");
    assert.equal(init?.method, "GET");
    return new Response(JSON.stringify({data:[{id:"example"}]}),{status:200});
  };
  assert.equal(await verifyNeonAiGateway(env(), mock as typeof fetch), "reachable");
  assert.equal(requests,1);
});
