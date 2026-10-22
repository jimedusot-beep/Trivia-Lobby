import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedJson } from "./bounded-response";
test("AI response limits reject oversized and malformed provider data",async()=>{
  assert.deepEqual(await readBoundedJson(new Response('{"cards":[]}')),{cards:[]});
  await assert.rejects(()=>readBoundedJson(new Response('x'.repeat(200)),100),/limit/);
  await assert.rejects(()=>readBoundedJson(new Response('{bad json')));
});
