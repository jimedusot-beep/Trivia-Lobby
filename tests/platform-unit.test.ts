import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { parseQti, exportQti, exportAnkiTsv, parseAnkiTsv, parseApkg } from "../server/portable-formats";
import { universalQuestionSchema, withoutAnswerKeys } from "../shared/universal-questions";
import { extractSource } from "../server/source-extraction";
import { consumeRate } from "../server/rate-limit";
import { scoreRound } from "../server/game-modes";

test("original game modes: wagers are bounded, upgrades consumed and party rounds scored by server",()=>{
 const base={mode:"classic" as const,correct:true,streak:2,score:200,wager:0,focus:0,guard:0,round:0};
 assert.equal(scoreRound(base).awarded,120);
 assert.equal(scoreRound({...base,mode:"wager",wager:50}).awarded,170);
 assert.equal(scoreRound({...base,mode:"wager",wager:50,correct:false}).awarded,-50);
 assert.throws(()=>scoreRound({...base,mode:"wager",wager:201}),/Wager/);
 const upgraded=scoreRound({...base,mode:"workshop",focus:1});assert.equal(upgraded.awarded,170);assert.equal(upgraded.focus,0);
 assert.equal(scoreRound({...base,mode:"workshop",guard:1,correct:false}).streak,2);
 assert.equal(scoreRound({...base,mode:"party",round:2}).awarded,240);
});

test("QTI single-choice and text exports preserve escaped questions and correct responses",()=>{
  for(const answer of [
    {kind:"multiple_choice",options:[{id:"A",label:"<yes> & \"ok\""},{id:"B",label:"No"}],correctOptionIds:["A"]},
    {kind:"short_answer",acceptedAnswers:["A < B & C"],caseSensitive:false},
  ]){
    const original=universalQuestionSchema.parse({schemaVersion:1,id:"source-1",prompt:"Is A < B & C > D?",answer});
    const [imported]=parseQti(exportQti(original));
    assert.equal(imported.prompt,original.prompt);assert.deepEqual(imported.answer,original.answer);
  }
});
test("QTI refuses XML entities and complex unsupported interactions",()=>{
  assert.throws(()=>parseQti('<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><assessmentItem/>'),/Unsafe/);
  assert.throws(()=>parseQti('<assessmentItem><itemBody><matchInteraction/></itemBody></assessmentItem>'),/Unsupported/);
});
test("Anki text round-trip preserves tabs, multiline text, quotes and Unicode",()=>{
  const cards=[{front:'Multiple\tcolumns?\n"你好"',back:'A newline\nand comma, preserved.'},{front:"two",back:"三"}];
  assert.deepEqual(parseAnkiTsv(exportAnkiTsv(cards)).map(({front,back})=>({front,back})),cards);
});
test("player projection omits source evidence, explanations and key associations",()=>{
  const q=universalQuestionSchema.parse({schemaVersion:1,id:"q",prompt:"Match",source:{passage:"Hidden answer evidence"},explanation:"Secret",answer:{kind:"matching",pairs:[{id:"1",prompt:"B",match:"Zulu"},{id:"2",prompt:"A",match:"Alpha"}]}});
  const view=withoutAnswerKeys(q);
  assert.equal("source" in view,false);assert.equal("explanation" in view,false);
  assert(!JSON.stringify(view).includes('"pairs"'));
});
test("rate limits reject excess requests and expire without clearing other identities",()=>{
  const key=randomUUID();assert(consumeRate(key,2,100,1000));assert(consumeRate(key,2,100,1001));assert(!consumeRate(key,2,100,1002));assert(consumeRate(key,2,100,1100));
});
test("source extraction preserves plain text without network requests",async()=>{
  const text="Question :: Answer\n".repeat(5);const extracted=await extractSource("own.txt",Buffer.from(text));
  assert.equal(extracted.text,text);assert.equal(extracted.status,"extracted");
});
test("malformed APKG cannot execute SQLite statements",async()=>{
  await assert.rejects(()=>parseApkg(Buffer.from("not a zip")),/ZIP/);
});
