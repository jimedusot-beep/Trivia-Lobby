import test from "node:test";
import assert from "node:assert/strict";
import {familyShows50,showForLanguage,selectDeck,familyBoards} from "../bilingual-family-catalog.js";
import {drawingPrompts500,charadesCategories10,charadesClues500,localizePrompt} from "../bilingual-party-prompts.js";
import {validateShow} from "../public/show-format.js";

test("50 complete bilingual show packs preserve scored board contract",()=>{
 assert.equal(familyShows50.length,50);
 assert.equal(new Set(familyShows50.map(s=>s.id)).size,50);
 assert.equal(familyBoards.length,50);
 for(const pack of familyShows50){
   assert.equal(pack.rounds.length,3);
   assert.equal(pack.final.length,5);
   for(const locale of ["en","es"]){
     const show=validateShow(showForLanguage(pack,locale));
     for(const board of [...show.rounds,...show.final])
       assert.equal(board.answers.reduce((total,a)=>total+a.points,0),100);
   }
 }
});
test("selector honors theme difficulty and predictable no-repeat rotation",()=>{
 const matches=familyShows50.filter(s=>s.theme==="nature");
 const first=selectDeck(familyShows50,{theme:"nature",completed:0});
 assert.equal(first.id,matches[0].id);
 for(let i=0;i<matches.length;i++)
   assert.equal(selectDeck(familyShows50,{theme:"nature",completed:i}).id,matches[i].id);
 assert.throws(()=>selectDeck(familyShows50,{theme:"missing"}),/matching/);
 assert.throws(()=>selectDeck(familyShows50,{completed:-1}),/Invalid/);
});
test("500 unique bilingual drawing prompts",()=>{
 assert.equal(drawingPrompts500.length,500);
 for(const locale of ["en","es"])assert.equal(new Set(drawingPrompts500.map(p=>localizePrompt(p,locale).toLocaleLowerCase(locale))).size,500);
});
test("10 charades categories each have 50 bilingual clues",()=>{
 assert.equal(Object.keys(charadesCategories10).length,10);
 assert.equal(charadesClues500.length,500);
 for(const clues of Object.values(charadesCategories10))assert.equal(clues.length,50);
 for(const locale of ["en","es"])assert.equal(new Set(charadesClues500.map(p=>localizePrompt(p,locale).toLocaleLowerCase(locale))).size,500);
});
