import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { attachGameSocket } from "../server/live-game";
import { MemoryRoomCheckpointStore } from "../server/room-checkpoints";
import type { IStorage } from "../server/storage";
import type { GameReportSink } from "../server/game-report-types";
import { setTimeout as delay } from "node:timers/promises";

function inbox(ws: WebSocket) {
  const frames: any[] = [], waiting = new Set<(m: any) => void>();
  ws.on("message", raw => { const m = JSON.parse(raw.toString()); frames.push(m); for (const fn of waiting) fn(m); });
  return {
    ws, frames,
    send(type: string, payload: object = {}, metadata: object = {}) { ws.send(JSON.stringify({ v: 1, type, payload, ...metadata })); },
    async take(type: string): Promise<any> {
      const existing = frames.find(m => m.type === type);
      if (existing) { frames.splice(frames.indexOf(existing), 1); return existing; }
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { waiting.delete(receive); reject(new Error(`Missing ${type}; received ${frames.map(m => m.type)}`)); }, 2500);
        const receive = (m: any) => { if (m.type === type) { clearTimeout(timer); waiting.delete(receive); frames.splice(frames.indexOf(m), 1); resolve(m); } };
        waiting.add(receive);
      });
    },
  };
}
const fixture = { async getDeck() { return { id: 1, cards: [
  { id: 1, deckId: 1, type: "multiple_choice", front: "Two plus two?", back: "Four", options: ["Four", "Five"], correctOption: "A" },
  { id: 2, deckId: 1, type: "multiple_choice", front: "One plus one?", back: "Two", options: ["Two", "Three"], correctOption: "A" },
] }; } } as unknown as IStorage;
async function launch(store: MemoryRoomCheckpointStore, questionMs = 60000, reportSink?: GameReportSink, deck = fixture) {
  const server = createServer();
  const owner = randomUUID();
  const wss = attachGameSocket(server, deck, { authorizeHost: async () => owner, questionMs, checkpointStore: store, reportSink } as any);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert(address && typeof address !== "string");
  const sockets: WebSocket[] = [];
  return {
    async open() { const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`); sockets.push(ws); const messages = inbox(ws); await once(ws, "open"); return messages; },
    async close() { for (const ws of sockets) ws.terminate(); await new Promise<void>(resolve => wss.close(() => server.close(() => resolve()))); },
  };
}

test("quiz scoring and credentials survive process replacement without exposing answer keys", async t => {
  const store = new MemoryRoomCheckpointStore(); let server = await launch(store); t.after(() => server.close());
  const host = await server.open(); host.send("create_room", { deckId: 1 });
  const created = (await host.take("room_created")).payload;
  const player = await server.open(); player.send("join_room", { roomCode: created.roomCode, playerName: "Ada" });
  const credential = (await player.take("room_joined")).payload;
  host.send("start_game", { roomCode: created.roomCode });
  const question = await player.take("question_start");
  assert.equal(question.payload.correctOption, undefined);
  player.send("submit_answer", { questionIndex: 0, answer: "A" });
  assert.equal((await player.take("answer_result")).payload.awarded, 100);
  await server.close(); server = await launch(store);
  const resumed = await server.open(); resumed.send("rejoin_room", credential);
  await resumed.take("room_joined");
  const snapshot = (await resumed.take("sync_snapshot")).payload;
  assert.equal(snapshot.state, "reveal");
  assert.equal(snapshot.score, 100);
  assert.equal(snapshot.players.length, 1);
  assert.equal(snapshot.answerResult.awarded, 100);
  const saved = await store.load("quiz", created.roomCode);
  assert(saved);
  assert(!JSON.stringify(saved.state).includes(credential.token));
  assert(!JSON.stringify(saved.state).includes(created.hostToken));
});

test("a committed round's pending report is repaired after a restart", async t => {
  const store = new MemoryRoomCheckpointStore();
  const unavailable: GameReportSink = { async created() {}, async round() { throw new Error("report storage unavailable"); }, async finished() {} };
  let server = await launch(store, 60000, unavailable); t.after(() => server.close());
  const host = await server.open(); host.send("create_room", { deckId: 1 }); const created = (await host.take("room_created")).payload;
  const player = await server.open(); player.send("join_room", { roomCode: created.roomCode, playerName: "Report repair" });
  const credential = (await player.take("room_joined")).payload;
  host.send("start_game", { roomCode: created.roomCode }); await player.take("question_start");
  player.send("submit_answer", { questionIndex: 0, answer: "A" }); await player.take("answer_result");
  await server.close();
  let repaired: any;
  const saved = new Promise<void>(resolve => { repaired = resolve; });
  const repair: GameReportSink = { async created() {}, async round(round) { assert.equal(round.playerAnswers[0].awarded, 100); assert.equal(round.questionIndex, 0); repaired(); }, async finished() {} };
  server = await launch(store, 60000, repair);
  const resumed = await server.open(); resumed.send("rejoin_room", credential); await resumed.take("room_joined");
  await Promise.race([saved, new Promise((_, reject) => setTimeout(() => reject(new Error("Pending round was lost")), 1500))]);
});

test("a lost rotated-credential response can be recovered by replaying its exact resume request", async t => {
  const store = new MemoryRoomCheckpointStore(); let server = await launch(store); t.after(() => server.close());
  const host = await server.open(); host.send("create_room", { deckId: 1 });
  const created = (await host.take("room_created")).payload;
  const original = await server.open(); original.send("join_room", { roomCode: created.roomCode, playerName: "Lost response" });
  const credential = (await original.take("room_joined")).payload;
  const requestId = randomUUID(), firstResume = await server.open();
  firstResume.send("rejoin_room", credential, { requestId });
  const rotated = (await firstResume.take("room_joined")).payload;
  await server.close(); server = await launch(store);
  const retry = await server.open(); retry.send("rejoin_room", credential, { requestId });
  const replay = (await retry.take("room_joined")).payload;
  assert.equal(replay.token, rotated.token);
  retry.send("confirm_session", { roomCode: credential.roomCode }, { requestId: randomUUID() }); await retry.take("action_ack");
  const impostor = await server.open(); impostor.send("rejoin_room", credential, { requestId });
  assert.match((await impostor.take("error")).payload.message, /Invalid reconnect/);
});

test("quiz storage failure releases no accepted answer or score and reconnect restores the last commit", async t => {
  const store = new MemoryRoomCheckpointStore(); let server = await launch(store); t.after(() => server.close());
  const host = await server.open(); host.send("create_room", { deckId: 1 });
  const created = (await host.take("room_created")).payload;
  const player = await server.open(); player.send("join_room", { roomCode: created.roomCode, playerName: "Safe answer" });
  const credential = (await player.take("room_joined")).payload;
  host.send("start_game", { roomCode: created.roomCode }); await player.take("question_start");
  const save = store.save.bind(store); store.save = async () => { throw new Error("provider details must stay private"); };
  player.send("submit_answer", { questionIndex: 0, answer: "A" }, { requestId: randomUUID() });
  assert.match((await player.take("error")).payload.message, /recovery/i);
  assert(!player.frames.some(frame => frame.type === "action_ack" || frame.type === "answer_result"));
  store.save = save; await server.close(); server = await launch(store);
  const retry = await server.open(); retry.send("rejoin_room", credential); await retry.take("room_joined");
  const restored = (await retry.take("sync_snapshot")).payload;
  assert.equal(restored.score, 0); assert.equal(restored.answered, false);
});

test("quiz action retries replay their acknowledgment and cannot advance the host twice", async t => {
  const store = new MemoryRoomCheckpointStore(); const server = await launch(store); t.after(() => server.close());
  const host = await server.open(); host.send("create_room", { deckId: 1 });
  const created = (await host.take("room_created")).payload;
  await host.take("sync_snapshot");
  const player = await server.open(); player.send("join_room", { roomCode: created.roomCode, playerName: "Lin" });
  await player.take("room_joined"); await player.take("sync_snapshot");
  host.send("start_game", { roomCode: created.roomCode }); await player.take("question_start");
  const requestId = randomUUID(); player.send("submit_answer", { questionIndex: 0, answer: "A" }, { requestId });
  assert.equal((await player.take("action_ack")).payload.requestId, requestId);
  await player.take("answer_result");
  player.send("submit_answer", { questionIndex: 0, answer: "A" }, { requestId });
  assert.equal((await player.take("action_ack")).payload.requestId, requestId);
  assert.equal((await player.take("sync_snapshot")).payload.score, 100);
  player.send("submit_answer", { questionIndex: 0, answer: "B" }, { requestId });
  assert.match((await player.take("error")).payload.message, /conflict/i);
  const nextId = randomUUID(); host.send("next_question", { roomCode: created.roomCode }, { requestId: nextId });
  await host.take("action_ack"); await host.take("leaderboard");
  host.send("next_question", { roomCode: created.roomCode }, { requestId: nextId });
  await host.take("action_ack");
  assert.equal((await host.take("sync_snapshot")).payload.state, "leaderboard");
});

test("twenty quiz phones sharing an IP can reconnect repeatedly without losing authoritative scores", async t => {
  const store = new MemoryRoomCheckpointStore(); const server = await launch(store); t.after(() => server.close());
  const host = await server.open(); host.send("create_room", { deckId: 1 }); const created = (await host.take("room_created")).payload;
  const players = await Promise.all(Array.from({ length: 20 }, () => server.open()));
  let credentials = await Promise.all(players.map(async (player, index) => {
    player.send("join_room", { roomCode: created.roomCode, playerName: `Quiz phone ${index}` }); return (await player.take("room_joined")).payload;
  }));
  host.send("start_game", { roomCode: created.roomCode }); await Promise.all(players.map(player => player.take("question_start")));
  await Promise.all(players.map(async player => {
    player.send("submit_answer", { questionIndex: 0, answer: "A" }, { requestId: randomUUID() }); await player.take("action_ack");
  }));
  for (let round = 0; round < 2; round++) {
    const resumed = await Promise.all(players.map(() => server.open()));
    credentials = await Promise.all(resumed.map(async (player, index) => {
      player.send("rejoin_room", credentials[index]); const credential = (await player.take("room_joined")).payload;
      const snapshot = (await player.take("sync_snapshot")).payload;
      assert.equal(snapshot.score, 100); assert.equal(snapshot.players.length, 20); return credential;
    }));
  }
  host.send("next_question", { roomCode: created.roomCode });
  const board = (await host.take("leaderboard")).payload.leaderboard;
  assert.equal(board.length, 20); assert(board.every((player: any) => player.connected && player.score === 100));
});

test("a quiz deadline elapsed during shutdown closes once without resetting the clock", async t => {
  const store = new MemoryRoomCheckpointStore(); let server = await launch(store, 80); t.after(() => server.close());
  const host = await server.open(); host.send("create_room", { deckId: 1 }); const created = (await host.take("room_created")).payload;
  const player = await server.open(); player.send("join_room", { roomCode: created.roomCode, playerName: "Deadline" });
  const credential = (await player.take("room_joined")).payload;
  host.send("start_game", { roomCode: created.roomCode }); const question = await player.take("question_start");
  await server.close(); await delay(120); server = await launch(store);
  const resumed = await server.open(); resumed.send("rejoin_room", credential); await resumed.take("room_joined");
  const snapshot = (await resumed.take("sync_snapshot")).payload;
  assert.equal(snapshot.state, "reveal"); assert.equal(snapshot.score, 0);
  assert.equal(snapshot.question.deadlineTs, question.payload.deadlineTs);
  resumed.send("submit_answer", { questionIndex: 0, answer: "A" }); assert.match((await resumed.take("error")).payload.message, /deadline/i);
});

test("the first phone back after a restart cannot close a question before the other players return", async t => {
  const store = new MemoryRoomCheckpointStore(); let server = await launch(store); t.after(() => server.close());
  const host = await server.open(); host.send("create_room", { deckId: 1 }); const created = (await host.take("room_created")).payload;
  const players = await Promise.all([server.open(), server.open()]);
  const credentials = await Promise.all(players.map(async (player, index) => {
    player.send("join_room", { roomCode: created.roomCode, playerName: `Coming back ${index}` }); return (await player.take("room_joined")).payload;
  }));
  host.send("start_game", { roomCode: created.roomCode }); await players[0].take("question_start");
  await server.close(); server = await launch(store);
  const first = await server.open(); first.send("rejoin_room", credentials[0]); await first.take("room_joined"); await first.take("sync_snapshot");
  const requestId = randomUUID(); first.send("submit_answer", { questionIndex: 0, answer: "A" }, { requestId }); await first.take("action_ack");
  first.send("submit_answer", { questionIndex: 0, answer: "A" }, { requestId }); await first.take("action_ack");
  assert.equal((await first.take("sync_snapshot")).payload.state, "playing");
  const second = await server.open(); second.send("rejoin_room", credentials[1]); await second.take("room_joined"); await second.take("sync_snapshot");
  second.send("submit_answer", { questionIndex: 0, answer: "A" });
  assert.equal((await first.take("answer_result")).payload.awarded, 100);
  assert.equal((await second.take("answer_result")).payload.awarded, 100);
});

test("rapid lobby settings edits share a phase revision and preserve the final authoritative values", async t => {
  const deck = { async getDeck() { return { id: 1, cards: [
    { id: 1, deckId: 1, type: "multiple_choice", front: "Odd one out?", back: "A is different", options: ["A", "B", "C", "D"], correctOption: "A" },
  ] }; } } as unknown as IStorage;
  const store = new MemoryRoomCheckpointStore(); const server = await launch(store, 60000, undefined, deck); t.after(() => server.close());
  const host = await server.open(); host.send("create_room", { deckId: 1 }, { requestId: randomUUID() });
  const created = (await host.take("room_created")).payload;
  const initial = await host.take("sync_snapshot"), metadata = { matchId: initial.matchId, revision: initial.revision };
  const save = store.save.bind(store);
  store.save = async (...args) => { await delay(25); return save(...args); };
  const edits = [{ roundCount: 3 }, { roundCount: 30 }, { shuffleAnswers: true }, { timeLimitMs: 15000 }];
  const ids = edits.map(() => randomUUID());
  edits.forEach((edit, i) => host.send("configure_game", { roomCode: created.roomCode, mode: "odd_one_out", ...edit }, { ...metadata, requestId: ids[i] }));
  for (const id of ids) assert.equal((await host.take("action_ack")).payload.requestId, id);
  assert.equal(host.frames.some(frame => frame.type === "error"), false);
  const saved = await store.load("quiz", created.roomCode);
  assert.equal(saved!.state.room.oddRoundCount, 30);
  assert.equal(saved!.state.room.oddShuffleAnswers, true);
  assert.equal(saved!.state.room.oddTimeLimitMs, 15000);
  // An exact retry returns the current settings instead of applying the earlier edit again.
  host.frames.length = 0;
  host.send("configure_game", { roomCode: created.roomCode, mode: "odd_one_out", ...edits[0] }, { ...metadata, requestId: ids[0] });
  await host.take("action_ack");
  assert.deepEqual((await host.take("sync_snapshot")).payload.oddSettings,
    { roundCount: 30, timeLimitMs: 15000, shuffleQuestions: false, shuffleAnswers: true });
});

for (const role of ["host", "player"] as const) test(`a failed quiz ${role} replacement also disconnects its original socket`, async t => {
  const store = new MemoryRoomCheckpointStore(); const server = await launch(store); t.after(() => server.close());
  const host = await server.open(); host.send("create_room", { deckId: 1 }); const created = (await host.take("room_created")).payload;
  let original = host, credentials = created;
  if (role === "player") {
    original = await server.open(); original.send("join_room", { roomCode: created.roomCode, playerName: "Displaced phone" });
    credentials = (await original.take("room_joined")).payload;
  }
  const replacement = await server.open(), closed = once(original.ws, "close", { signal: AbortSignal.timeout(1500) });
  const save = store.save.bind(store);
  store.save = async () => { throw new Error("injected replacement failure"); };
  replacement.send(role === "host" ? "resume_host" : "rejoin_room", credentials, { requestId: randomUUID() });
  assert.match((await replacement.take("error")).payload.message, /recovery/i);
  assert.equal((await closed)[0], 1013);
  assert.match((await original.take("error")).payload.message, /recovery/i);
  assert(!replacement.frames.some(frame => frame.type === "host_resumed" || frame.type === "room_joined"));
  store.save = save;
  const recovered = await server.open(); recovered.send(role === "host" ? "resume_host" : "rejoin_room", credentials, { requestId: randomUUID() });
  await recovered.take(role === "host" ? "host_resumed" : "room_joined");
  assert.equal((await recovered.take("sync_snapshot")).payload.state, "lobby");
});
