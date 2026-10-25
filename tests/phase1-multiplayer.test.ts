import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
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

test("an unanswered deadline resets the streak before the next scored round", async t => {
  const storage={async getDeck(){const deck=await fakeStorage.getDeck(1,"owner");assert(deck);return {...deck,cards:[...deck.cards,{...deck.cards[0],id:3}]};}} as IStorage;
  const server=createServer(),wss=attachGameSocket(server,storage,{questionMs:500,authorizeHost:async()=>"owner"});
  server.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert(address&&typeof address!=="string");
  const sockets:WebSocket[]=[],url=`ws://127.0.0.1:${address.port}/ws`;
  const open=async()=>{const ws=new WebSocket(url);sockets.push(ws);const inbox=client(ws);await once(ws,"open");return inbox;};
  t.after(async()=>{for(const ws of sockets)ws.terminate();await new Promise<void>(resolve=>wss.close(()=>server.close(()=>resolve())));});
  const host=await open(),player=await open();host.send(WS_EVENTS.CREATE_ROOM,{deckId:1});const {roomCode}=(await host.take(WS_EVENTS.ROOM_CREATED)).payload;
  player.send(WS_EVENTS.JOIN_ROOM,{roomCode,playerName:"Recall player"});await player.take(WS_EVENTS.ROOM_JOINED);host.send(WS_EVENTS.START_GAME,{roomCode});await player.take(WS_EVENTS.QUESTION_START);
  player.send(WS_EVENTS.SUBMIT_ANSWER,{roomCode,questionIndex:0,answer:"B"});assert.equal((await player.take(WS_EVENTS.ANSWER_RESULT)).payload.awarded,100);
  const advance=async()=>{host.send(WS_EVENTS.NEXT_QUESTION,{roomCode});await host.take(WS_EVENTS.LEADERBOARD);host.send(WS_EVENTS.NEXT_QUESTION,{roomCode});await player.take(WS_EVENTS.QUESTION_START);};
  await advance();assert.equal((await player.take(WS_EVENTS.ANSWER_RESULT)).payload.isCorrect,false);
  await advance();player.send(WS_EVENTS.SUBMIT_ANSWER,{roomCode,questionIndex:2,answer:"B"});assert.equal((await player.take(WS_EVENTS.ANSWER_RESULT)).payload.awarded,100);
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

test("five players complete four question kinds with reveal-only keys, validated answers and configured scoring", async t => {
  const { universalQuestionSchema } = await import("../shared/universal-questions");
  const { liveCardFromUniversal } = await import("../server/live-question-projection");
  const definitions = [
    {schemaVersion:1, id:"a", prompt:"Select one", answer:{kind:"multiple_choice",options:[{id:"a",label:"Alpha"},{id:"b",label:"Beta"}],correctOptionIds:["a"]}},
    {schemaVersion:1, id:"b", prompt:"True?", gameplay:{timeLimitSeconds:5,points:"double"},answer:{kind:"true_false",correct:true}},
    {schemaVersion:1, id:"c", prompt:"Select two",answer:{kind:"multiple_select",options:[{id:"x",label:"X"},{id:"y",label:"Y"},{id:"z",label:"Z"}],correctOptionIds:["x","z"]}},
    {schemaVersion:1, id:"d", prompt:"Order it",answer:{kind:"ordering",items:[{id:"second",label:"Second"},{id:"first",label:"First"},{id:"third",label:"Third"}],correctOrderIds:["first","second","third"]}},
  ].map(value=>universalQuestionSchema.parse(value));
  const extras=definitions.map((q,i)=>liveCardFromUniversal(1,i+1,q)!);
  const storage={async getDeck(){return {id:1,cards:[]};}} as unknown as IStorage;
  const server=createServer(), wss=attachGameSocket(server,storage,{authorizeHost:async()=>"owner",questionMs:2500,extraQuestions:async()=>extras});
  server.listen(0,"127.0.0.1"); await once(server,"listening");
  const addr=server.address();assert(addr&&typeof addr!=="string");
  const sockets:WebSocket[]=[];
  const open=async()=>{const ws=new WebSocket(`ws://127.0.0.1:${addr.port}/ws`);sockets.push(ws);const inbox=client(ws);await once(ws,"open");return inbox;};
  t.after(async()=>{sockets.forEach(ws=>ws.terminate());await new Promise<void>(resolve=>wss.close(()=>server.close(()=>resolve())));});
  const host=await open();host.send(WS_EVENTS.CREATE_ROOM,{deckId:1});
  const {roomCode}=(await host.take(WS_EVENTS.ROOM_CREATED)).payload;
  const players=await Promise.all(Array.from({length:5},async(_,i)=>{const p=await open();p.send(WS_EVENTS.JOIN_ROOM,{roomCode,playerName:"P"+i});await p.take(WS_EVENTS.ROOM_JOINED);return p;}));
  host.send(WS_EVENTS.START_GAME,{roomCode});
  for(let i=0;i<4;i++){
    const question=(await host.take(WS_EVENTS.QUESTION_START)).payload;
    assert.equal(question.questionIndex,i);
    assert.equal(question.kind,definitions[i].answer.kind);
    assert(!JSON.stringify(question).includes("correctOptionIds")&&!JSON.stringify(question).includes("correctOrderIds")&&!JSON.stringify(question).includes('"correct":'));
    if(i===1)assert.equal(question.timeLimitMs,5000);
    if(i===2){
      players[0].send(WS_EVENTS.SUBMIT_ANSWER,{roomCode,questionIndex:i,answer:{selectedIds:["unlisted"]}});
      assert.match((await players[0].take(WS_EVENTS.ERROR)).payload.message,/Invalid answer option/);
    }
    if(i===2 || i===3) assert(question.optionIds.every((id:string)=>/^[0-9a-f-]{36}$/.test(id)));
    const optionId=(label:string)=>question.optionIds[question.choices.indexOf(label)];
    const answer=i===0?"A":i===1?{value:true}:i===2?{selectedIds:[optionId("X"),optionId("Z")]}:{orderIds:[optionId("First"),optionId("Second"),optionId("Third")]};
    players.forEach(p=>p.send(WS_EVENTS.SUBMIT_ANSWER,{roomCode,questionIndex:i,answer}));
    const reveals=await Promise.all(players.map(p=>p.take(WS_EVENTS.ANSWER_RESULT)));
    assert(reveals.every(r=>r.payload.isCorrect===true));
    if(i===1)assert.equal(reveals[0].payload.awarded,220);
    if(i===3)assert.deepEqual(reveals[0].payload.correctAnswers,["First","Second","Third"]);
    await host.take(WS_EVENTS.ANSWER_RESULT);
    host.send(WS_EVENTS.NEXT_QUESTION,{roomCode});await host.take(WS_EVENTS.LEADERBOARD);
    host.send(WS_EVENTS.NEXT_QUESTION,{roomCode});
  }
  const finish=(await host.take(WS_EVENTS.GAME_OVER)).payload;
  assert.equal(finish.leaderboard.length,5);
  assert(finish.leaderboard.every((p:any)=>p.score>0));
});

test("REA vault: host-only submission progress counts accepted answers and survives reconnect",async t=>{
  const testOwner="rea-progress-"+randomUUID();
  const server=createServer(),wss=attachGameSocket(server,fakeStorage,{questionMs:5000,authorizeHost:async()=>testOwner});
  server.listen(0,"127.0.0.1");await once(server,"listening");
  const address=server.address();assert(address&&typeof address!=="string");
  const url="ws://127.0.0.1:"+address.port+"/ws",sockets:WebSocket[]=[],leaks:string[]=[];
  const open=async(watch=false)=>{
    const ws=new WebSocket(url);sockets.push(ws);
    if(watch)ws.on("message",raw=>{const msg=JSON.parse(raw.toString());if(msg.type===WS_EVENTS.SUBMISSION_PROGRESS)leaks.push(msg.type);});
    const inbox=client(ws);await once(ws,"open");return inbox;
  };
  t.after(async()=>{for(const ws of sockets)ws.terminate();await new Promise<void>(resolve=>wss.close(()=>server.close(()=>resolve())));});
  const host=await open(),p1=await open(true),p2=await open(true);
  host.send(WS_EVENTS.CREATE_ROOM,{deckId:1});
  const {roomCode,hostToken}=(await host.take(WS_EVENTS.ROOM_CREATED)).payload;
  p1.send(WS_EVENTS.JOIN_ROOM,{roomCode,playerName:"Fast"});
  p2.send(WS_EVENTS.JOIN_ROOM,{roomCode,playerName:"Slow"});
  await p1.take(WS_EVENTS.ROOM_JOINED);await p2.take(WS_EVENTS.ROOM_JOINED);
  host.send(WS_EVENTS.CONFIGURE_GAME,{roomCode,mode:"sprint"});
  assert.equal((await host.take(WS_EVENTS.GAME_CONFIGURED)).payload.mode,"sprint");
  host.send(WS_EVENTS.START_GAME,{roomCode});await host.take(WS_EVENTS.QUESTION_START);
  assert.deepEqual((await host.take(WS_EVENTS.SUBMISSION_PROGRESS)).payload,{questionIndex:0,received:0,total:2,connected:2});
  p1.send(WS_EVENTS.SUBMIT_ANSWER,{roomCode,questionIndex:0,answer:"B"});
  assert.equal((await host.take(WS_EVENTS.SUBMISSION_PROGRESS)).payload.received,1);
  p1.send(WS_EVENTS.SUBMIT_ANSWER,{roomCode,questionIndex:0,answer:"B"});
  assert.match((await p1.take(WS_EVENTS.ERROR)).payload.message,/already submitted/);
  const reconnectedHost=await open();
  reconnectedHost.send(WS_EVENTS.RESUME_HOST,{roomCode,hostToken});
  await reconnectedHost.take(WS_EVENTS.HOST_RESUMED);
  assert.equal((await reconnectedHost.take(WS_EVENTS.SYNC_SNAPSHOT)).payload.state,"playing");
  assert.deepEqual((await reconnectedHost.take(WS_EVENTS.SUBMISSION_PROGRESS)).payload,{questionIndex:0,received:1,total:2,connected:2});
  p2.send(WS_EVENTS.SUBMIT_ANSWER,{roomCode,questionIndex:0,answer:"A"});
  assert.equal((await reconnectedHost.take(WS_EVENTS.SUBMISSION_PROGRESS)).payload.received,2);
  await reconnectedHost.take(WS_EVENTS.ANSWER_RESULT);
  assert.deepEqual(leaks,[]);
});
