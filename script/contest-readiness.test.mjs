import test from "node:test";
import assert from "node:assert/strict";
import { checkContestDemo, validateContestUrl } from "./contest-readiness.mjs";

const liveSha = "a".repeat(40);
function mockFetch(overrides = {}) {
  const responses = {
    "/health/live": { body: '{"status":"ok"}', type: "application/json" },
    "/health/ready": { body: '{"status":"ready"}', type: "application/json" },
    "/party/": {
      body: '<!doctype html><html><body><button id="create">Host</button><form id="join"></form><p>No account needed</p></body></html>',
      type: "text/html",
    },
    "/party/app.js": { body: "export const joinParty = () => { console.log('guest room and multiplayer interaction work on the same origin'); };".repeat(2), type: "text/javascript" },
    "/party/style.css": { body: ".public-party { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); }".repeat(2), type: "text/css" },
    "/party/open-source/credits.json": { body: JSON.stringify({ commit: liveSha }), type: "application/json" },
    ...overrides,
  };
  return async url => {
    const item = responses[new URL(url).pathname];
    return item
      ? new Response(item.body, { status: item.status ?? 200, headers: { "content-type": item.type } })
      : new Response("Not found", { status: 404 });
  };
}

test("public contest check confirms guest UI, assets and exact deployed commit", async () => {
  const result = await checkContestDemo({ fetchImpl: mockFetch(), expectedSha: liveSha, retryHealthMs: 0 });
  assert.equal(result.deployedSha, liveSha);
  assert.equal(result.target, "https://trivia-lobby.onrender.com/party/");
  assert.equal(result.checks.length, 5);
});

test("stale public deployment fails instead of giving false confidence", async () => {
  await assert.rejects(() => checkContestDemo({
    fetchImpl: mockFetch(), expectedSha: "b".repeat(40), retryHealthMs: 0,
  }), /Public deployment is stale/);
});

test("missing guest join controls fail the public check", async () => {
  await assert.rejects(() => checkContestDemo({
    fetchImpl: mockFetch({ "/party/": { body: "<html><body>Sign in</body></html>", type: "text/html" } }),
    retryHealthMs: 0,
  }), /Guest multiplayer entry is missing/);
});

test("public checker refuses arbitrary, insecure or private URLs", () => {
  assert.throws(() => validateContestUrl("http://trivia-lobby.onrender.com"), /Contest readiness only/);
  assert.throws(() => validateContestUrl("https://127.0.0.1"), /Contest readiness only/);
  assert.throws(() => validateContestUrl("https://some-other-site.example"), /Contest readiness only/);
});
