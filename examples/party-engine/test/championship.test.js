import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";

function setup() {
  let time = 1000, requests = 0;
  const p = new Party("ABCDEF", { clock: () => time, countdownMs: 1,
    customQuiz: { title: "Single round", questions: [
      { prompt: "Pick A", choices: ["A","B"], correct: 0, points: 100, seconds: 1 }
    ] },
  });
  const ids = ["Ann", "Ben", "Chris"].map(name => p.join(name));
  function action(actor, type, value) {
    return p.handle(actor, {
      v:1,type,requestId:`champ-request-${++requests}`,
      matchId:p.matchId,revision:p.revision,
      ...(value === undefined ? {} : {value}),
    });
  }
  return { p, ids, action, advance(n) { time += n; p.tick(); } };
}

test("one QR party carries normalized championship points across Tap Dash and trivia", () => {
  const {p,ids,action,advance}=setup();
  action("host","start","tap"); advance(2);
  assert.equal(p.mode,"tap");
  p.players.get(ids[0]).score=60;
  p.players.get(ids[1]).score=20;
  p.players.get(ids[2]).score=0;
  p.enter("finished");
  let view=p.view("host");
  assert.deepEqual(view.championship.standings.map(x=>x.points),[100,80,0]);
  assert.equal(view.championship.gamesPlayed,1);
  p.enter("finished"); // Must not duplicate awards on timeout/replay.
  assert.equal(p.view(ids[0]).championship.standings[0].points,100);
  action("host","lobby");
  action("host","start","quiz"); advance(2);
  assert.deepEqual(ids.map(id=>p.players.get(id).score),[0,0,0],"Match scores reset independently");
  action(ids[1],"answer",0);
  advance(1100);
  assert.equal(p.phase,"reveal");
  action("host","next");
  assert.equal(p.phase,"finished");
  view=p.view("host");
  assert.equal(view.championship.gamesPlayed,2);
  const standings=Object.fromEntries(view.championship.standings.map(x=>[x.name,x]));
  assert.equal(standings.Ann.points,100);
  assert.equal(standings.Ben.points,180);
  assert.equal(standings.Chris.points,0);
  assert.deepEqual(view.championship.recent.map(x=>x.mode),["quiz","tap"]);
  assert.deepEqual(view.championship.recent[0].winners,["Ben"]);
  assert.deepEqual(p.view(ids[2]).championship.standings,view.championship.standings);
});

test("ties share championship placement; interrupted and aborted games never award points", () => {
  const {p,ids,action,advance}=setup();
  action("host","start","tap");advance(2);
  p.players.get(ids[0]).score=15;
  p.players.get(ids[1]).score=15;
  p.players.get(ids[2]).score=5;
  p.enter("finished");
  let entries=Object.fromEntries(p.view("host").championship.standings.map(x=>[x.name,x]));
  assert.equal(entries.Ann.points,100);
  assert.equal(entries.Ben.points,100);
  assert.equal(entries.Chris.points,60);
  action("host","lobby");action("host","start","tap");advance(2);
  action("host","play",{action:"end-match"});
  assert.equal(p.view("host").championship.gamesPlayed,1,"Host aborted second game");
  action("host","lobby");action("host","start","tap");advance(2);
  p.interrupted=true;p.enter("finished");
  assert.equal(p.view("host").championship.gamesPlayed,1,"Interrupted third game");
  assert.equal(p.view("host").championship.standings.length,3);
});

test("completed match id can only be awarded once even after re-entry", () => {
  const {p,ids,action,advance}=setup();
  action("host","start","tap");advance(2);
  p.players.get(ids[0]).score=50;
  p.enter("finished");
  p.enter("reveal");p.enter("finished");
  assert.equal(p.view("host").championship.gamesPlayed,1);
  assert.equal(p.view("host").championship.standings[0].points,100);
});
