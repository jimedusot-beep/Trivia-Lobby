import test from "node:test";
import assert from "node:assert/strict";
import { pingBackupHeartbeat } from "../script/backup-heartbeat.mjs";

const secret = "https://hc-ping.com/example-private-token";

test("unconfigured heartbeat performs no external request", async () => {
  let calls = 0;
  const send = async () => { calls++; throw new Error("should not run"); };
  assert.deepEqual(await pingBackupHeartbeat("", send), { configured:false, delivered:false });
  assert.equal(calls, 0);
});

test("only HTTPS token-bearing ping URLs are accepted", async () => {
  const send = async () => { throw new Error("should not run"); };
  for (const url of ["http://hc-ping.com/secret", "https://hc-ping.com/", "https://u:p@hc-ping.com/x", "https://hc-ping.com/x?token=secret", "https://hc-ping.com/x#secret", "not-a-url", "https://localhost/check"]) {
    await assert.rejects(pingBackupHeartbeat(url, send), /Backup heartbeat/);
  }
});

test("successful backup heartbeat uses one GET without redirects or secret logging", async () => {
  const calls = [];
  const response = await pingBackupHeartbeat(secret, async (url, options) => {
    calls.push({url, options});
    return {ok:true};
  });
  assert.deepEqual(response, {configured:true,delivered:true});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, secret);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.signal.aborted, false);
});

test("remote errors or exceptions never leak the secret URL", async () => {
  for (const send of [async () => ({ok:false,status:403}), async () => { throw new Error("request to " + secret + " failed"); }]) {
    await assert.rejects(pingBackupHeartbeat(secret, send), err => {
      assert.match(err.message, /delivery failed/);
      assert.doesNotMatch(err.message, /example-private-token/);
      assert.equal(err.cause, undefined);
      return true;
    });
  }
});
