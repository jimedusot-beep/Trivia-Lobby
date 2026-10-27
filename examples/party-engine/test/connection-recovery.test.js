import test from "node:test";
import assert from "node:assert/strict";
import { createRecoveringConnection } from "../public/connection-recovery.js";

function harness() {
  let now = 0, next = 0;
  const timers = new Map(), sockets = [], statuses = [], messages = [];
  const setTimer = (fn, ms) => { const id = ++next; timers.set(id, { at: now + ms, fn }); return id; };
  const clearTimer = id => timers.delete(id);
  function advance(ms) {
    const until = now + ms;
    for (;;) {
      const due = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]); now = due[1].at; due[1].fn();
    }
    now = until;
  }
  const lifecycle = new EventTarget(), visibility = new EventTarget();
  const connection = createRecoveringConnection("ws://example.test/socket", {
    createSocket() {
      const socket = { readyState: 0, sent: [],
        open() { this.readyState = 1; this.onopen?.({}); },
        send(frame) { this.sent.push(frame); },
        close(code = 1006, reason = "") { this.readyState = 3; this.onclose?.({ code, reason }); },
      };
      sockets.push(socket); return socket;
    },
    onStatus: status => statuses.push(status), onMessage: event => messages.push(event.data),
    setTimer, clearTimer, random: () => 0.5, lifecycle, visibility, isVisible: () => true,
  });
  return { connection, sockets, statuses, messages, advance, lifecycle, visibility };
}

test("socket opening waits for authenticated room readiness before reporting connected", () => {
  const h = harness(); h.sockets[0].open();
  assert.equal(h.statuses.at(-1), "restoring");
  h.connection.ready(); assert.equal(h.statuses.at(-1), "connected");
  h.connection.stop();
});

test("repeated failures back off and a recovered room resets the delay", () => {
  const h = harness(); h.sockets[0].close(); h.advance(499); assert.equal(h.sockets.length, 1);
  h.advance(1); assert.equal(h.sockets.length, 2);
  h.sockets[1].open(); h.sockets[1].close(); h.advance(999); assert.equal(h.sockets.length, 2);
  h.advance(1); assert.equal(h.sockets.length, 3);
  h.sockets[2].open(); h.connection.ready(); h.sockets[2].close(); h.advance(500);
  assert.equal(h.sockets.length, 4); h.connection.stop();
});

test("replaced sessions stop retrying and old sockets cannot deliver stale state", () => {
  const h = harness(), old = h.sockets[0]; old.open(); h.connection.ready();
  h.lifecycle.dispatchEvent(new Event("online")); h.advance(500);
  const current = h.sockets[1]; current.open(); h.connection.ready();
  old.onmessage({ data: "old state" }); old.onclose({ code: 1006, reason: "late close" });
  assert.deepEqual(h.messages, []);
  assert.equal(h.connection.socket, current);
  current.close(1000, "Session replaced"); h.advance(60000);
  assert.equal(h.sockets.length, 2); assert.equal(h.statuses.at(-1), "closed");
});

test("a silent half-open socket is replaced after the heartbeat deadline", () => {
  const h = harness(); h.sockets[0].open(); h.connection.ready();
  h.advance(10000); assert.equal(h.sockets[0].readyState, 3);
  h.advance(500); assert.equal(h.sockets.length, 2); h.connection.stop();
});
