import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import WebSocket from "ws";
import { attachGameSocket, makeRoomCode } from "../server/live-game";
import { WS_EVENTS } from "../shared/schema";
import { clientMessageSchema, serverMessageSchema } from "../shared/game-protocol";
import type { IStorage } from "../server/storage";

type WireEvent = { v: number; type: string; payload: any };
function client(ws: WebSocket) {
  const queue: WireEvent[] = [];
  const waiting: Array<{ type: string; done: (x: WireEvent) => void }> = [];
  ws.on("message", raw => {
    const msg = JSON.parse(raw.toString()) as WireEvent;
    const i = waiting.findIndex(x => x.type === msg.type);
    if (i >= 0) waiting.splice(i, 1)[0].done(msg);
    else queue.push(msg);
  });
  return {
    ws,
    send(type: string, payload: object = {}) { ws.send(JSON.stringify({ v: 1, type, payload })); },
    async take(type: string, timeout = 1500): Promise<WireEvent> {
      const i = queue.findIndex(x => x.type === type);
      if (i >= 0) return queue.splice(i, 1)[0];
      return await new Promise<WireEvent>((resolve, reject) => {
        const entry = { type, done: (msg: WireEvent) => { clearTimeout(timer); resolve(msg); } };
        const timer = setTimeout(() => {
          const index = waiting.indexOf(entry);
          if (index !== -1) waiting.splice(index, 1);
          reject(new Error("Timed out waiting for " + type + "; saw " + queue.map(x => x.type)));
        }, timeout);
        waiting.push(entry);
      });
    },
  };
}

const fakeStorage = {
  async getDeck() {
    return { id: 1, cards: [
      { id: 1, deckId: 1, type: "multiple_choice", front: "Capital?", back: "Paris", options: ["Rome", "Paris", "Oslo", "Lima"], correctOption: "B" },
      { id: 2, deckId: 1, type: "multiple_choice", front: "Two?", back: "2", options: ["1", "2", "3", "4"], correctOption: "B" },
    ] };
  },
} as unknown as IStorage;

test("oversized WebSocket frames close only the offending connection", async t => {
  const server=createServer(),wss=attachGameSocket(server,fakeStorage,{authorizeHost:async()=>"owner"});
  server.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert(address&&typeof address!=="string");
  const url=`ws://127.0.0.1:${address.port}/ws`,sockets:WebSocket[]=[];
  t.after(async()=>{for(const ws of sockets)ws.terminate();await new Promise<void>(resolve=>wss.close(()=>server.close(()=>resolve())));});
  const bad=new WebSocket(url);sockets.push(bad);await once(bad,"open");const closed=once(bad,"close");bad.send("x".repeat(5000));assert.equal((await closed)[0],1009);
  const healthy=new WebSocket(url);sockets.push(healthy);const inbox=client(healthy);await once(healthy,"open");inbox.send(WS_EVENTS.CREATE_ROOM,{deckId:1});assert.ok((await inbox.take(WS_EVENTS.ROOM_CREATED)).payload.roomCode);
});

test("protocol rejects unknown version, events and fields", () => {
  assert.equal(clientMessageSchema.safeParse({ v: 2, type: "start_game", payload: {} }).success, false);
  assert.equal(clientMessageSchema.safeParse({ v: 1, type: "destroy_room", payload: {} }).success, false);
  assert.equal(clientMessageSchema.safeParse({ v: 1, type: "start_game", payload: { admin: true } }).success, false);
  assert.equal(serverMessageSchema.safeParse({ v: 1, type: "game_over", payload: { leaderboard: [{ name: "A", score: 1, ws: {} }] } }).success, false);
});

test("secure room codes are valid and avoid occupied values", () => {
  const occupied = new Map<string, unknown>();
  for (let i = 0; i < 1000; i++) {
    const code = makeRoomCode(occupied);
    assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
    assert(!occupied.has(code));
    occupied.set(code, true);
  }
});

test("host and two players complete secure match; reconnect, deadlines, duplicates, permissions", async t => {
  const server = createServer();
  const wss = attachGameSocket(server, fakeStorage, { questionMs: 180, authorizeHost: async () => "test-owner" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  const url = "ws://127.0.0.1:" + address.port + "/ws";
  const opened: WebSocket[] = [];
  async function open() {
    const ws = new WebSocket(url);
    opened.push(ws);
    const inbox = client(ws);
    await once(ws, "open");
    return inbox;
  }
  t.after(async () => {
    for (const ws of opened) ws.terminate();
    await new Promise<void>(resolve => wss.close(() => server.close(() => resolve())));
  });

  const host = await open();
  host.send(WS_EVENTS.CREATE_ROOM, { deckId: 1 });
  const created = (await host.take(WS_EVENTS.ROOM_CREATED)).payload;
  const roomCode = created.roomCode;
  assert.equal(created.hostToken.length > 32, true);
  const p1 = await open();
  const p2 = await open();
  p1.send(WS_EVENTS.JOIN_ROOM, { roomCode, playerName: "Ada" });
  p2.send(WS_EVENTS.JOIN_ROOM, { roomCode, playerName: "Lin" });
  const join1 = (await p1.take(WS_EVENTS.ROOM_JOINED)).payload;
  const join2 = (await p2.take(WS_EVENTS.ROOM_JOINED)).payload;
  await p1.take(WS_EVENTS.SYNC_SNAPSHOT);
  await p2.take(WS_EVENTS.SYNC_SNAPSHOT);
  assert.notEqual(join1.playerId, join2.playerId);
  assert(join1.token && join2.token);

  const intruder = await open();
  intruder.send(WS_EVENTS.REJOIN_ROOM, { roomCode, playerId: join1.playerId, token: join2.token });
  assert.match((await intruder.take(WS_EVENTS.ERROR)).payload.message, /Invalid reconnect/);
  intruder.send(WS_EVENTS.START_GAME, { roomCode });
  await intruder.take(WS_EVENTS.ERROR);

  host.send(WS_EVENTS.START_GAME, { roomCode });
  await host.take(WS_EVENTS.GAME_STARTED);
  const q1 = (await p1.take(WS_EVENTS.QUESTION_START)).payload;
  assert.equal(q1.prompt, "Capital?");
  assert.equal(q1.questionIndex, 0);
  assert(!("correctLetter" in q1) && !("correctOption" in q1) && !("back" in q1));
  await p2.take(WS_EVENTS.QUESTION_START);

  p1.send(WS_EVENTS.SUBMIT_ANSWER, { roomCode, questionIndex: 0, answer: "B" });
  p1.send(WS_EVENTS.SUBMIT_ANSWER, { roomCode, questionIndex: 0, answer: "B" });
  assert.match((await p1.take(WS_EVENTS.ERROR)).payload.message, /already submitted/);
  p2.send(WS_EVENTS.SUBMIT_ANSWER, { roomCode, questionIndex: 0, answer: "A" });
  const r1 = (await p1.take(WS_EVENTS.ANSWER_RESULT)).payload;
  const r2 = (await p2.take(WS_EVENTS.ANSWER_RESULT)).payload;
  assert.equal(r1.isCorrect, true);
  assert.equal(r1.awarded, 100);
  assert.equal(r2.isCorrect, false);
  await host.take(WS_EVENTS.ANSWER_RESULT);

  host.send(WS_EVENTS.NEXT_QUESTION, { roomCode });
  const leaderboard = (await host.take(WS_EVENTS.LEADERBOARD)).payload.leaderboard;
  assert.equal(leaderboard.find((x: any) => x.playerId === join1.playerId).score, 100);
  assert(!leaderboard.some((x: any) => "ws" in x || "tokenHash" in x || "streak" in x));

  // Replacement socket with valid player token retains score and phase.
  const resumedPlayer = await open();
  resumedPlayer.send(WS_EVENTS.REJOIN_ROOM, { roomCode, playerId: join1.playerId, token: join1.token });
  const newPlayerSession = (await resumedPlayer.take(WS_EVENTS.ROOM_JOINED)).payload;
  assert.notEqual(newPlayerSession.token, join1.token);
  const sync = (await resumedPlayer.take(WS_EVENTS.SYNC_SNAPSHOT)).payload;
  assert.equal(sync.state, "leaderboard");
  assert.equal(sync.score, 100);

  const resumedHost = await open();
  resumedHost.send(WS_EVENTS.RESUME_HOST, { roomCode, hostToken: created.hostToken });
  const newHostSession = (await resumedHost.take(WS_EVENTS.HOST_RESUMED)).payload;
  assert.notEqual(newHostSession.hostToken, created.hostToken);
  assert.equal((await resumedHost.take(WS_EVENTS.SYNC_SNAPSHOT)).payload.state, "leaderboard");
  resumedHost.send(WS_EVENTS.NEXT_QUESTION, { roomCode });
  const second = (await resumedPlayer.take(WS_EVENTS.QUESTION_START)).payload;
  assert.equal(second.questionIndex, 1);

  // Expiry is server-enforced, even if the client still shows answer controls.
  await new Promise(resolve => setTimeout(resolve, 230));
  await resumedPlayer.take(WS_EVENTS.ANSWER_RESULT);
  resumedPlayer.send(WS_EVENTS.SUBMIT_ANSWER, { roomCode, questionIndex: 1, answer: "B" });
  assert.match((await resumedPlayer.take(WS_EVENTS.ERROR)).payload.message, /deadline passed/);
  resumedHost.send(WS_EVENTS.NEXT_QUESTION, { roomCode });
  await resumedHost.take(WS_EVENTS.LEADERBOARD);
  resumedHost.send(WS_EVENTS.NEXT_QUESTION, { roomCode });
  const finished = (await resumedHost.take(WS_EVENTS.GAME_OVER)).payload;
  assert.equal(finished.leaderboard.find((x: any) => x.playerId === join1.playerId).score, 100);
});

test("new rooms require authenticated ownership; workshop and buzzer actions enforce role, phase and cost",async t=>{
 const server=createServer(),wss=attachGameSocket(server,fakeStorage,{questionMs:5000,authorizeHost:async req=>req.headers["x-test-owner"]==="owner"?"owner":null});
 server.listen(0,"127.0.0.1");await once(server,"listening");const url=`ws://127.0.0.1:${(server.address() as any).port}/ws`;
 const sockets:WebSocket[]=[];
 const open=async(owner=false)=>{const ws=new WebSocket(url,{headers:owner?{"x-test-owner":"owner"}:{}});sockets.push(ws);const inbox=client(ws);await once(ws,"open");return inbox;};
 t.after(async()=>{sockets.forEach(ws=>ws.terminate());await new Promise<void>(r=>wss.close(()=>server.close(()=>r())));});
 const denied=await open();denied.send(WS_EVENTS.CREATE_ROOM,{deckId:1});assert.match((await denied.take(WS_EVENTS.ERROR)).payload.message,/Sign in/);
 const host=await open(true);host.send(WS_EVENTS.CREATE_ROOM,{deckId:1});const {roomCode}=(await host.take(WS_EVENTS.ROOM_CREATED)).payload;
 const p1=await open(),p2=await open();p1.send(WS_EVENTS.JOIN_ROOM,{roomCode,playerName:"A"});p2.send(WS_EVENTS.JOIN_ROOM,{roomCode,playerName:"B"});
 const joined=(await p1.take(WS_EVENTS.ROOM_JOINED)).payload;await p2.take(WS_EVENTS.ROOM_JOINED);await p1.take(WS_EVENTS.SYNC_SNAPSHOT);await p2.take(WS_EVENTS.SYNC_SNAPSHOT);
 p1.send(WS_EVENTS.CONFIGURE_GAME,{roomCode,mode:"workshop"});assert.match((await p1.take(WS_EVENTS.ERROR)).payload.message,/Host/);
 host.send(WS_EVENTS.CONFIGURE_GAME,{roomCode,mode:"workshop"});await p1.take(WS_EVENTS.GAME_CONFIGURED);
 host.send(WS_EVENTS.START_GAME,{roomCode});await p1.take(WS_EVENTS.QUESTION_START);await p2.take(WS_EVENTS.QUESTION_START);
 p1.send(WS_EVENTS.BUY_UPGRADE,{roomCode,upgrade:"focus"});assert.match((await p1.take(WS_EVENTS.ERROR)).payload.message,/between rounds/);
 p1.send(WS_EVENTS.SUBMIT_ANSWER,{roomCode,questionIndex:0,answer:"B"});p2.send(WS_EVENTS.SUBMIT_ANSWER,{roomCode,questionIndex:0,answer:"B"});
 await p1.take(WS_EVENTS.ANSWER_RESULT);assert.equal((await p1.take(WS_EVENTS.PLAYER_STATUS)).payload.coins,80);
 p1.send(WS_EVENTS.BUY_UPGRADE,{roomCode,upgrade:"focus"});assert.deepEqual((await p1.take(WS_EVENTS.PLAYER_STATUS)).payload,{coins:20,focus:1,guard:0});
 p1.send(WS_EVENTS.BUY_UPGRADE,{roomCode,upgrade:"guard"});await p1.take(WS_EVENTS.ERROR);
 host.send(WS_EVENTS.NEXT_QUESTION,{roomCode});await host.take(WS_EVENTS.LEADERBOARD);host.send(WS_EVENTS.NEXT_QUESTION,{roomCode});await p1.take(WS_EVENTS.QUESTION_START);
 p1.send(WS_EVENTS.SUBMIT_ANSWER,{roomCode,questionIndex:1,answer:"B"});p2.send(WS_EVENTS.SUBMIT_ANSWER,{roomCode,questionIndex:1,answer:"B"});
 assert.equal((await p1.take(WS_EVENTS.ANSWER_RESULT)).payload.awarded,160);assert.equal((await p1.take(WS_EVENTS.PLAYER_STATUS)).payload.focus,0);
 host.send(WS_EVENTS.NEXT_QUESTION,{roomCode});await host.take(WS_EVENTS.LEADERBOARD);host.send(WS_EVENTS.NEXT_QUESTION,{roomCode});
 assert.equal((await host.take(WS_EVENTS.GAME_OVER)).payload.leaderboard.find((p:any)=>p.playerId===joined.playerId).score,260);

 const host2=await open(true);host2.send(WS_EVENTS.CREATE_ROOM,{deckId:1});const code2=(await host2.take(WS_EVENTS.ROOM_CREATED)).payload.roomCode;
 const a=await open(),b=await open();a.send(WS_EVENTS.JOIN_ROOM,{roomCode:code2,playerName:"Buzz A"});b.send(WS_EVENTS.JOIN_ROOM,{roomCode:code2,playerName:"Buzz B"});
 const sessionA=(await a.take(WS_EVENTS.ROOM_JOINED)).payload;await b.take(WS_EVENTS.ROOM_JOINED);await a.take(WS_EVENTS.SYNC_SNAPSHOT);await b.take(WS_EVENTS.SYNC_SNAPSHOT);
 host2.send(WS_EVENTS.CONFIGURE_GAME,{roomCode:code2,mode:"buzzer"});await a.take(WS_EVENTS.GAME_CONFIGURED);host2.send(WS_EVENTS.START_GAME,{roomCode:code2});await a.take(WS_EVENTS.QUESTION_START);await b.take(WS_EVENTS.QUESTION_START);
 a.send(WS_EVENTS.SUBMIT_ANSWER,{roomCode:code2,questionIndex:0,answer:"B"});assert.match((await a.take(WS_EVENTS.ERROR)).payload.message,/Buzz in/);
 a.send(WS_EVENTS.BUZZ,{roomCode:code2,questionIndex:0});let buzz=await a.take(WS_EVENTS.BUZZ_STATE);if(buzz.payload.playerId===null)buzz=await a.take(WS_EVENTS.BUZZ_STATE);assert.equal(buzz.payload.playerId,sessionA.playerId);
 b.send(WS_EVENTS.BUZZ,{roomCode:code2,questionIndex:0});await b.take(WS_EVENTS.ERROR);
 a.send(WS_EVENTS.SUBMIT_ANSWER,{roomCode:code2,questionIndex:0,answer:"A"});await a.take(WS_EVENTS.ANSWER_ACCEPTED);
 b.send(WS_EVENTS.BUZZ,{roomCode:code2,questionIndex:0});b.send(WS_EVENTS.SUBMIT_ANSWER,{roomCode:code2,questionIndex:0,answer:"B"});assert.equal((await b.take(WS_EVENTS.ANSWER_RESULT)).payload.isCorrect,true);
});
