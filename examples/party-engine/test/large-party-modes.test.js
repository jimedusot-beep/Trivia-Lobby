import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createPartyServer } from "../server.js";
import { socialModes } from "../social-games.js";
import { bonusModes } from "../bonus-games.js";

const modes = [...socialModes, ...bonusModes]; // All 11 newly integrated modes
function fakeClock() {
  let now = 1000;
  const jobs = [];
  return {
    clock: () => now,
    setTimer(fn, delay) { const j = { fn, due: now + delay, cancelled: false }; jobs.push(j); return j; },
    clearTimer(j) { j.cancelled = true; },
    advance(ms) {
      now += ms;
      // Execute callbacks currently due, including any immediate follow-up.
      for (let n = 0; n < 100; n++) {
        const next = jobs.find(j => !j.cancelled && j.due <= now);
        if (!next) break;
        next.cancelled = true;
        next.fn();
      }
    },
  };
}
function peer(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`, { origin: `http://127.0.0.1:${port}` });
  const inbox = [], waiters = new Set();
  ws.on("message", raw => {
    const m = JSON.parse(raw.toString());
    inbox.push(m);
    for (const notify of waiters) notify();
  });
  return {
    ws,
    send(m) { ws.send(JSON.stringify(m)); },
    wait(predicate, name = "server event") {
      const found = inbox.find(predicate);
      if (found) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { waiters.delete(check); reject(new Error("Timeout waiting for " + name)); }, 4000);
        function check() {
          const m = inbox.find(predicate);
          if (!m) return;
          clearTimeout(timer);
          waiters.delete(check);
          resolve(m);
        }
        waiters.add(check);
      });
    },
  };
}
function action(party, type, value, req) {
  return { v: 1, type, requestId: req, matchId: party.matchId, revision: party.revision, value };
}
async function runScenario(mode, size, t) {
  const clock = fakeClock();
  const app = createPartyServer({
    partyOptions: { clock: clock.clock, countdownMs: 1 },
    schedulerOptions: clock,
  });
  const sockets = [];
  t.after(async () => { for (const s of sockets) s.ws.terminate(); await app.close(); });
  await new Promise(resolve => app.server.listen(0, "127.0.0.1", resolve));
  const port = app.server.address().port;
  async function connect() {
    const p = peer(port);
    sockets.push(p);
    await once(p.ws, "open");
    return p;
  }
  const host = await connect();
  host.send({type:"create"});
  const room = await host.wait(m=>m.type==="credential", "host credential");
  assert.match(room.code, /^[A-HJ-NP-Z2-9]{6}$/);
  const invite = new URL(`http://127.0.0.1:${port}/?code=${room.code}`);
  assert.equal(invite.searchParams.get("code"), room.code);
  const players = [];
  for (let i = 0; i < size; i++) {
    const guest = await connect();
    guest.send({type:"join", code:invite.searchParams.get("code"), name:`Guest ${i}`});
    const credential = await guest.wait(m=>m.type==="credential", "join credential");
    players.push({ peer: guest, credential });
  }
  const party = app.rooms.get(room.code).party;
  assert.equal(party.players.size, size);
  assert.equal((await host.wait(m=>m.type==="state"&&m.state.players.length===size, "lobby roster")).state.players.length, size);

  // Simulate the QR invite's deep link and a real reconnect: no nickname impersonation.
  const original = players[0], replacement = await connect();
  replacement.send({type:"resume", code:room.code, actor:original.credential.actor, token:"invalid"});
  await replacement.wait(m=>m.type==="error", "reject forged reconnect");
  const resumed = await connect();
  resumed.send({type:"resume", code:room.code, actor:original.credential.actor, token:original.credential.token});
  await resumed.wait(m=>m.type==="ready", "credential reconnect");
  players[0] = {peer:resumed, credential:original.credential};
  const rejoined = (await resumed.wait(m=>m.type==="state"&&m.state.phase==="lobby", "lobby recovery")).state;
  assert.equal(rejoined.players.length, size);
  assert.equal(rejoined.players.find(p=>p.id===original.credential.actor).name,"Guest 0");

  host.send(action(party, "start", mode, "host-start-"+mode));
  await host.wait(m=>m.type==="state"&&m.state.phase==="countdown", "start countdown");
  clock.advance(1);
  const expected = mode==="impostor"?"clue": ["caption","percentage"].includes(mode)?"writing":"question";
  const opened = (await resumed.wait(m=>m.type==="state"&&m.state.mode===mode&&m.state.phase===expected, "mode open")).state;
  assert.equal(opened.players.length,size);
  // Extra answers, bingo patterns, secret roles and answer keys remain server-only before reveal.
  if (mode==="closest") assert.ok(!Object.hasOwn(opened.social,"target"));
  if (mode==="timeline") assert.ok(!Object.hasOwn(opened.bonus,"correctOrder"));
  if (mode==="impostor") assert.ok(!Object.hasOwn(opened.social,"impostor"));

  let req = 0;
  async function submit(i, value) {
    const participant=players[i], name="answer-"+mode+"-"+size+"-"+(++req);
    participant.peer.send(action(party, "respond", value, name));
    await participant.peer.wait(m=>m.type==="ack"&&m.requestId===name, "response accepted");
  }
  for (let i=0;i<size;i++) {
    if (mode==="bingo") break; // Bingo is timed; cards are private and marking happens on subsequent calls.
    let value;
    switch (mode) {
      case "majority": value=i%2; break;
      case "likely": value=players[(i+1)%size].credential.actor; break;
      case "closest": value=88; break;
      case "survey": value="Passport"; break;
      case "impostor": value="Fun family clue"; break;
      case "percentage": value=i%2; break;
      case "category": value="Peach"; break;
      case "caption": value=`Original caption ${i}`; break;
      case "timeline": value="0,1,2,3"; break;
      case "bracket": value=i%2; break;
      default: throw new Error("Untested mode "+mode);
    }
    await submit(i,value);
  }
  if (mode==="impostor" || mode==="caption" || mode==="percentage") {
    await host.wait(m=>m.type==="state"&&m.state.phase==="voting", "voting phase");
    for(let i=0;i<size;i++) {
      let value;
      if(mode==="impostor") value=players[(i+1)%size].credential.actor;
      else if(mode==="percentage") value=50;
      else {
        const view=party.view(players[i].credential.actor).bonus;
        value=view.votable[0];
      }
      await submit(i,value);
    }
  }
  if(mode==="bingo") {
    // Server-driven timer, plus private 4x4 cards for every client, including the resumed one.
    for (const p of players) {
      const view=party.view(p.credential.actor);
      assert.equal(view.bonus.card.length,16);
      assert.equal(Object.hasOwn(party.view("host").bonus,"card"),false);
    }
    clock.advance(12000);
  }
  const reveal = (await host.wait(m=>m.type==="state"&&m.state.phase==="reveal", "round reveal")).state;
  assert.equal(reveal.players.length,size);
  assert.ok(reveal.players.every(p=>Number.isSafeInteger(p.score)&&p.score>=0));
  assert.equal(party.roster.length,size);
  // Reconnect must retain the verified score and the current phase without exposing credentials.
  const again=await connect();
  again.send({type:"resume",code:room.code,actor:original.credential.actor,token:original.credential.token});
  await again.wait(m=>m.type==="ready", "reveal reconnect");
  const snapshot=(await again.wait(m=>m.type==="state"&&m.state.phase==="reveal", "reveal snapshot")).state;
  assert.equal(snapshot.players.length,size);
  assert.equal(snapshot.players.find(p=>p.id===original.credential.actor).score,
    reveal.players.find(p=>p.id===original.credential.actor).score);
  assert.doesNotMatch(JSON.stringify(snapshot), /resumeToken|secretToken|credential/);
  // Host reconnects using its issued token, not a guessable room code. The
  // replacement inherits the current round, without resetting scores or time.
  const hostReturn = await connect();
  hostReturn.send({ type:"resume", code:room.code, actor:"host", token:room.token });
  await hostReturn.wait(m=>m.type==="ready", "host credential recovery");
  const restoredHost=(await hostReturn.wait(m=>m.type==="state"&&m.state.phase==="reveal", "host state recovery")).state;
  assert.equal(restoredHost.role,"host");
  assert.deepEqual(restoredHost.players.map(p=>p.score), reveal.players.map(p=>p.score));
  hostReturn.send(action(party,"next",undefined,"host-next-"+mode));
  const advanced=(await hostReturn.wait(m=>m.type==="state"&&m.state.index===1, "next round")).state;
  assert.equal(advanced.mode,mode);
  assert.ok(["question","writing","clue"].includes(advanced.phase));
}
for(const mode of modes){
  for(const size of [10,20]){
    test(`${mode}: ${size} QR-invited guests, authenticated reconnect, private scoring, reveal, next round`,
      {timeout:30000}, async t=>runScenario(mode,size,t));
  }
}
