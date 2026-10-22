import test from "node:test";
import assert from "node:assert/strict";
import { exportQti,parseQti,exportAnkiText,parseAnkiText } from "./interchange";
import { universalQuestionSchema,gradeUniversalAnswer } from "@shared/universal-questions";
test("QTI choice/text export and import preserve prompts, labels, explanations and scoring",()=>{
  const make=(answer:unknown,prompt:string)=>universalQuestionSchema.parse({schemaVersion:1,id:prompt,prompt,explanation:"Evidence & explanation",answer});
  const questions=[make({kind:"multiple_choice",options:[{id:"a space",label:"Wrong < answer"},{id:"ok",label:"Correct & answer"}],correctOptionIds:["ok"]},"Question & <tag>?"),make({kind:"short_answer",acceptedAnswers:["Paris"]},"Capital?")];
  const result=parseQti(exportQti(questions));
  assert.equal(result.length,2);assert.equal(result[0].prompt,questions[0].prompt);assert.equal(result[0].explanation,questions[0].explanation);
  assert(gradeUniversalAnswer(result[0],{selectedIds:["choice_2"]}));assert(gradeUniversalAnswer(result[1],{text:"Paris"}));
  assert.throws(()=>parseQti(Buffer.from('<!DOCTYPE x [<!ENTITY a "b">]><assessmentItem/>')),/Unsafe|XML entities/);
  assert.throws(()=>exportQti([make({kind:"true_false",correct:true},"Truth?")]),/Unsupported/);
});
test("Anki Basic UTF-8 quoted text preserves tabs, quotes, newlines and literal HTML",()=>{
  const cards=[{front:'Term\twith "quote"',back:'Answer\nwith <literal> & Ω'},{front:"two",back:"two back"}];
  const restored=parseAnkiText(exportAnkiText(cards));assert.deepEqual(restored.map(({front,back})=>({front,back})),cards);
  assert.throws(()=>parseAnkiText("#separator:tab\nOnly one field"));
});
