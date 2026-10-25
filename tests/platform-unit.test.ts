import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { parseQti, parseQtiFile, exportQti, exportQtiPackage, exportAnkiTsv, parseAnkiTsv, parseApkg, storedZip } from "../server/portable-formats";
import initSqlJs from "sql.js";
import { deduplicateCards } from "../server/card-dedup";
test("repeated legacy imports collapse duplicates and refuse silent answer replacement",()=>{
 const card={front:"A question",back:"Answer",type:"flashcard" as const,options:[],correctOption:null};
 assert.equal(deduplicateCards([card,{...card,front:" A   question "}]).length,1);
 assert.equal(deduplicateCards([card],[card]).length,0);
 assert.throws(()=>deduplicateCards([{...card,back:"Conflicting"}],[card]),/different answers/);
});
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

test("sprint rewards faster server-timed correct answers and clamps late inputs",()=>{
  const base={mode:"sprint" as const,correct:true,streak:0,score:0,wager:0,focus:0,guard:0,round:0,timeLimitMs:20_000};
  assert.equal(scoreRound({...base,responseMs:0}).awarded,1000);
  assert.equal(scoreRound({...base,responseMs:10_000}).awarded,750);
  assert.equal(scoreRound({...base,responseMs:20_000}).awarded,500);
  assert.equal(scoreRound({...base,responseMs:99_000}).awarded,500);
  assert.equal(scoreRound({...base,responseMs:10_000,correct:false}).awarded,0);
  assert.equal(scoreRound({...base,responseMs:10_000,pointsFactor:2}).awarded,1500);
});
test("QTI single-choice and text exports preserve escaped questions and correct responses",()=>{
  for(const answer of [
    {kind:"multiple_choice",options:[{id:"A",label:"<yes> & \"ok\""},{id:"B",label:"No"}],correctOptionIds:["A"]},
    {kind:"short_answer",acceptedAnswers:["A < B & C"],caseSensitive:true},
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
  const cards=[{front:'Multiple\tcolumns?\n"你好"',back:'A newline\n#part of answer\nand comma, preserved.'},{front:"#two",back:"三"}];
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
function originalPdf(content:string){
 const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
 let pdf="%PDF-1.4\n";const offsets=[0];
 objects.forEach((body,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${body}\nendobj\n`;});
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return Buffer.from(pdf);
}
test("PDF worker extracts source text with a real original PDF fixture",async()=>{
 const extracted=await extractSource("original.pdf",originalPdf("BT /F1 12 Tf 20 50 Td (Memory :: Review) Tj ET"));assert.match(extracted.text,/Memory\s*::\s*Review/);assert.equal(extracted.pages,1);assert.equal(extracted.status,"extracted");
});
test("PDF without text requires OCR and does not present page markers as source evidence",async()=>{
 const extracted=await extractSource("image-only.pdf",originalPdf("q Q"));assert.equal(extracted.text,"");assert.equal(extracted.pages,1);assert.equal(extracted.status,"ocr-required");
});
test("malformed APKG cannot execute SQLite statements",async()=>{
  await assert.rejects(()=>parseApkg(Buffer.from("not a zip")),/ZIP/);
});
test("QTI package round-trip preserves every supported item",()=>{
 const questions=["First?","Second?"].map(prompt=>universalQuestionSchema.parse({schemaVersion:1,id:randomUUID(),prompt,answer:{kind:"short_answer",acceptedAnswers:["Answer"],caseSensitive:true}}));
 const restored=parseQtiFile(exportQtiPackage(questions));assert.deepEqual(restored.map(q=>q.prompt),questions.map(q=>q.prompt));
});
test("legacy basic Anki SQLite package converts text while custom note models are rejected",async()=>{
 const SQL=await initSqlJs(),database=new SQL.Database();
 try{
  database.run("CREATE TABLE col(models TEXT); CREATE TABLE notes(mid INTEGER,flds TEXT)");
  database.run("INSERT INTO col VALUES(?)",[JSON.stringify({1:{type:0,flds:[{name:"Front"},{name:"Back"}],tmpls:[{qfmt:"{{Front}}",afmt:"{{FrontSide}}<hr>{{Back}}"}]}})]);
  database.run("INSERT INTO notes VALUES(1,?)",["Question\x1fAnswer"]);
  const cards=await parseApkg(storedZip({"collection.anki2":Buffer.from(database.export())}));assert.equal(cards[0].front,"Question");assert.equal(cards[0].back,"Answer");
  database.run("UPDATE col SET models='{}'");await assert.rejects(()=>parseApkg(storedZip({"collection.anki2":Buffer.from(database.export())})),/custom Anki/);
 }finally{database.close();}
});
