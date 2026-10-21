import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const manifest = JSON.parse(readFileSync(new URL("../docs/research/ai-reconstruction-candidates.json", import.meta.url), "utf8"));
test("research entries have unique normalized repository URLs and valid evidence labels", () => {
 const seen = new Set();
 const labels = new Set(manifest.evidenceLabels);
 const tracks = new Set(Object.keys(manifest.tracks));
 assert.equal(manifest.schemaVersion, 1);
 assert.ok(manifest.entries.length >= 15);
 for (const e of manifest.entries) {
  assert.ok(tracks.has(e.track), "unknown track: "+e.track);
  assert.ok(labels.has(e.evidence), "unknown evidence label: "+e.evidence);
  const parsed = new URL(e.url);
  assert.equal(parsed.hostname, "github.com");
  assert.match(parsed.pathname, /^\/[\w.-]+\/[\w.-]+\/?$/);
  const key = parsed.pathname.replace(/\/$/, "").toLowerCase();
  assert.ok(!seen.has(key), "duplicate repo: "+key);
  seen.add(key);
  for (const key of ["name", "application", "limitation"]) assert.ok(typeof e[key] === "string" && e[key].trim());
 }
});
