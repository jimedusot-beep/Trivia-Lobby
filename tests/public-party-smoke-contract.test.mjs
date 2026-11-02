import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertPartyPage, assertPartyAsset, assertPartyMissingAsset, assertPartyPing
} from "../script/public-party-smoke-contract.mjs";

const pageHeaders = () => new Headers({
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'self'; connect-src 'self'; frame-ancestors 'none'"
});
const file = name => readFileSync("examples/party-engine/public/" + name, "utf8");

test("real committed public game shelf and one-tab Solo Test satisfy release markers", () => {
  assert.doesNotThrow(() => assertPartyPage("/party/", { status: 200, headers: pageHeaders() }, file("index.html")));
  assert.doesNotThrow(() => assertPartyPage("/party/solo-test.html", { status: 200, headers: pageHeaders() }, file("solo-test.html")));
});

test("party smoke fails closed on unavailable, stale, unprotected or unrelated page", () => {
  const html = file("index.html");
  for (const status of [301, 401, 404, 500]) {
    assert.throws(() => assertPartyPage("/party/", { status, headers: pageHeaders() }, html), /HTTP 200/);
  }
  for (const [key, value, reason] of [
    ["content-type", "application/json", /return HTML/],
    ["cache-control", "public, max-age=3600", /must not be cached/],
    ["x-content-type-options", "", /MIME sniffing/],
    ["content-security-policy", "default-src *", /anti-framing/]
  ]) {
    const headers = pageHeaders();
    headers.set(key, value);
    assert.throws(() => assertPartyPage("/party/", { status: 200, headers }, html), reason);
  }
  assert.throws(() => assertPartyPage("/party/", { status: 200, headers: pageHeaders() }, "<html>Something else</html>"), /missing the required game control/);
  assert.throws(() => assertPartyPage("/not-party/", { status: 200, headers: pageHeaders() }, html), /Unexpected public party path/);
});

test("missing solo-seat UI fails instead of pretending 31-game Solo Test works", () => {
  const html = file("solo-test.html").replace('id="solo-all-seat-switch"', 'id="missing-seat-selector"');
  assert.throws(() => assertPartyPage("/party/solo-test.html", { status: 200, headers: pageHeaders() }, html), /solo-all-seat-switch/);
});

test("party JavaScript assets must exist and cannot be HTML fallbacks", () => {
  const response = () => ({ status: 200, headers: new Headers({
    "content-type": "text/javascript; charset=utf-8",
    "cache-control": "no-store"
  }) });
  for (const path of ["/party/app.js", "/party/solo-test.js"]) {
    assert.doesNotThrow(() => assertPartyAsset(path, response()));
    assert.throws(() => assertPartyAsset(path, { status: 404, headers: response().headers }), /must exist/);
    const htmlHeaders = new Headers(response().headers);
    htmlHeaders.set("content-type", "text/html");
    assert.throws(() => assertPartyAsset(path, { status: 200, headers: htmlHeaders }), /must be JavaScript/);
  }
  const missing = { status: 404, headers: new Headers({ "content-type": "text/plain" }) };
  assert.doesNotThrow(() => assertPartyMissingAsset(missing));
  assert.throws(() => assertPartyMissingAsset({ status: 200, headers: pageHeaders() }), /HTTP 404/);
  assert.throws(() => assertPartyAsset("/party/secret", response()), /Unexpected party asset/);
});

test("guest socket requires a real non-mutating pong, not any random frame", () => {
  assert.doesNotThrow(() => assertPartyPing({ type: "pong", serverNow: 1700000000000 }));
  for (const frame of [undefined, {}, { type: "ack" }, { type: "error" }, { type: "pong" }, { type: "pong", serverNow: "today" }]) {
    assert.throws(() => assertPartyPing(frame), /non-mutating ping/);
  }
});
