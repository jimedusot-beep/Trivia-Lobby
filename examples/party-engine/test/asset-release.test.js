import assert from "node:assert/strict";
import { createServer, get } from "node:http";
import { once } from "node:events";
import { mkdtemp, writeFile, utimes, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import { releaseAssets } from "../release-assets.js";

test("same URL revalidates across releases with identical size and mtime", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "party-release-"));
  t.after(() => rm(dir, {recursive:true, force:true}));
  async function deploy(bytes) {
    const file = path.join(dir, "app.js");
    await writeFile(file, bytes);
    await utimes(file, 1700000000, 1700000000);
    return releaseAssets(dir);
  }
  let active = await deploy("v1();");
  const app = express();
  app.use("/party", (req,res,next) => active(req,res,next));
  const server = createServer(app).listen(0,"127.0.0.1");
  await once(server,"listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = "http://127.0.0.1:"+server.address().port+"/party/app.js";
  const read = (headers={}) => new Promise((resolve,reject) => {
    get(url,{headers}, res => { let body=""; res.on("data", x=>body+=x);
      res.on("end",()=>resolve({status:res.statusCode,headers:res.headers,body})); }).on("error",reject);
  });
  const first = await read();
  assert.equal(first.body,"v1();");
  const conditional = {"If-None-Match":first.headers.etag};
  assert.equal((await read(conditional)).status,304);
  active = await deploy("v2();");
  const changed = await read(conditional);
  assert.equal(changed.status,200);
  assert.equal(changed.body,"v2();");
  assert.notEqual(changed.headers.etag, first.headers.etag);
});
