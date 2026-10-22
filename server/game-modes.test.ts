import test from "node:test";
import assert from "node:assert/strict";
import { scoreAnswer } from "./game-modes";
const base = { mode:"classic" as const, correct:true, score:100, streak:2, wager:0, questionIndex:0 };
test("mode scoring keeps stakes bounded, upgrades single-use and party bonuses predictable",()=>{
  assert.equal(scoreAnswer(base).awarded,120);
  assert.equal(scoreAnswer({...base,mode:"wager",wager:50,correct:false}).score,50);
  assert.throws(()=>scoreAnswer({...base,mode:"wager",wager:101}));
  assert.throws(()=>scoreAnswer({...base,wager:1}));
  assert.equal(scoreAnswer({...base,mode:"party",questionIndex:1}).awarded,240);
  assert.equal(scoreAnswer({...base,upgrade:"boost"}).awarded,170);
  assert.equal(scoreAnswer({...base,upgrade:"streak_guard",correct:false}).streak,2);
});
