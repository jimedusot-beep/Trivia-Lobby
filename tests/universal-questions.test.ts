import assert from "node:assert/strict";
import test from "node:test";
import {
  gradeUniversalAnswer, legacyCardToQuestion, universalQuestionSchema,
  withoutAnswerKeys, type UniversalQuestion,
} from "../shared/universal-questions";

const base = (answer: unknown) => ({schemaVersion:1,id:"test-1",prompt:"Find the right answer",answer});
function parse(answer: unknown): UniversalQuestion {return universalQuestionSchema.parse(base(answer));}
test("legacy flashcard and multiple choice convert correctly",()=>{
  const card=legacyCardToQuestion({id:1,front:"Capital?",back:"Paris",type:"flashcard",options:null,correctOption:null});
  assert.equal(card.answer.kind,"text");
  const quiz=legacyCardToQuestion({id:2,front:"Pick B",back:"Explanation",type:"multiple_choice",options:["No","Yes"],correctOption:"B"});
  assert.equal(quiz.answer.kind,"multiple_choice");
  assert.equal(gradeUniversalAnswer(quiz,{selectedIds:["B"]}),true);
  assert.throws(()=>legacyCardToQuestion({id:3,front:"Q",back:"A",type:"multiple_choice",options:["X","Y"],correctOption:"D"}));
});
test("multiple choice and multiple select reject fabricated or repeated option IDs",()=>{
  const options=[{id:"A",label:"a"},{id:"B",label:"b"}];
  assert.equal(universalQuestionSchema.safeParse(base({kind:"multiple_choice",options,correctOptionIds:["C"]})).success,false);
  assert.equal(universalQuestionSchema.safeParse(base({kind:"multiple_choice",options:[options[0],options[0]],correctOptionIds:["A"]})).success,false);
  assert.equal(universalQuestionSchema.safeParse(base({kind:"multiple_choice",options,correctOptionIds:["A","B"]})).success,false);
  const question=parse({kind:"multiple_select",options,correctOptionIds:["A","B"]});
  assert.equal(gradeUniversalAnswer(question,{selectedIds:["B","A"]}),true);
  assert.equal(gradeUniversalAnswer(question,{selectedIds:["A","A"]}),false);
});
test("matching pairs are graded by labels, not revealing pair IDs",()=>{
  const q=parse({kind:"matching",pairs:[
    {id:"one",prompt:"uno",match:"one"},
    {id:"two",prompt:"dos",match:"two"},
  ]});
  const view=withoutAnswerKeys(q);
  assert.ok(!JSON.stringify(view).includes('"pairs"'));
  assert.equal(gradeUniversalAnswer(q,{matchIds:{one:"one",two:"two"}}),true);
  assert.equal(gradeUniversalAnswer(q,{matchIds:{one:"two",two:"one"}}),false);
  assert.equal(universalQuestionSchema.safeParse(base({kind:"matching",pairs:[
    {id:"one",prompt:"1",match:"same"},{id:"two",prompt:"2",match:"same"}
  ]})).success,false);
});
test("hotspots use display-independent normalized coordinates",()=>{
  const q=parse({kind:"image_hotspot",imageUrl:"https://example.org/diagram.png",imageAlt:"Diagram",
    targets:[{id:"jaw",label:"Jaw",x:0.5,y:0.75,radius:0.05}],correctTargetIds:["jaw"]});
  assert.equal(gradeUniversalAnswer(q,{targetId:"jaw"}),true);
  const view=withoutAnswerKeys(q);
  assert.ok(!JSON.stringify(view).includes("correctTargetIds"));
  assert.ok(!JSON.stringify(view).includes('"label":"Jaw"'));
  assert.equal(universalQuestionSchema.safeParse(base({...q.answer, targets:[{id:"jaw",label:"Jaw",x:1.01,y:0.1,radius:0.05}]})).success,false);
  assert.equal(universalQuestionSchema.safeParse(base({...q.answer,correctTargetIds:["missing"]})).success,false);
  assert.equal(universalQuestionSchema.safeParse(base({...q.answer,imageUrl:"javascript:alert(1)"})).success,false);
});
test("text, truth, ordering, flashcard and labels are scored consistently",()=>{
  const q1=parse({kind:"short_answer",acceptedAnswers:["ParIs"],caseSensitive:false});
  assert.equal(gradeUniversalAnswer(q1,{text:" PARIS "}),true);
  const q2=parse({kind:"true_false",correct:false});
  assert.equal(gradeUniversalAnswer(q2,{value:false}),true);
  const q3=parse({kind:"ordering",items:[{id:"a",label:"first"},{id:"b",label:"second"}],correctOrderIds:["b","a"]});
  assert.equal(gradeUniversalAnswer(q3,{orderIds:["b","a"]}),true);
  assert.equal(gradeUniversalAnswer(q3,{orderIds:["a","b"]}),false);
  const q4=parse({kind:"flashcard",back:"Answer"});
  assert.equal(gradeUniversalAnswer(q4,{text:"answer"}),true);
  const q5=parse({kind:"drag_drop_labels",imageUrl:"https://example.org/a.png",imageAlt:"A",
    targets:[{id:"x",label:"first",x:0.2,y:0.3,radius:0.1},{id:"y",label:"second",x:0.5,y:0.7,radius:0.1}]});
  assert.equal(gradeUniversalAnswer(q5,{matchIds:{x:"first",y:"second"}}),true);
  assert.equal(gradeUniversalAnswer(q5,{matchIds:{x:"second",y:"first"}}),false);
  assert.ok(!JSON.stringify(withoutAnswerKeys(q5)).includes('"label":"first","x"'));
});
test("a key-free payload never includes solution keys or explanation",()=>{
  const q=universalQuestionSchema.parse({...base({kind:"multiple_choice",
    options:[{id:"A",label:"Wrong"},{id:"B",label:"Right"}],correctOptionIds:["B"]}), explanation:"The correct answer is B"});
  const view=withoutAnswerKeys(q);
  assert.ok(!JSON.stringify(view).includes("correctOptionIds"));
  assert.ok(!JSON.stringify(view).includes("The correct answer is B"));
  assert.throws(()=>gradeUniversalAnswer(q,{selectedIds:"B"}));
});
