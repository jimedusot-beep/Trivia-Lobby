import { randomUUID } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { zipSync, strToU8 } from "fflate";
import Papa from "papaparse";
import { universalQuestionSchema, type UniversalQuestion } from "@shared/universal-questions";
import { inspectArchive, readText, zipBytes } from "./library-parse";
import type { ImportableCard } from "../client/src/lib/deck-io";

const array = <T>(v: T | T[] | undefined): T[] => v === undefined ? [] : Array.isArray(v) ? v : [v];
function text(node: unknown, depth = 0): string {
  if (depth > 60) throw new Error("Unsupported XML nesting");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(x => text(x, depth + 1)).join(" ");
  if (!node || typeof node !== "object") return "";
  return Object.entries(node).filter(([key]) => !key.startsWith("@_")).map(([,v]) => text(v,depth+1)).join(" ").trim();
}
function find(node: unknown, key: string, depth = 0): any[] {
  if (depth > 60) throw new Error("Unsupported XML nesting");
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([k,v]) => k === key ? array(v) : find(v,key,depth+1));
}
function parseItem(xml: string): UniversalQuestion {
  if (xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Unsafe QTI XML");
  // Bound recursive parser depth before constructing its object graph.
  let depth = 0;
  for (const tag of xml.matchAll(/<\/?[A-Za-z_][^>]*>/g)) {
    if (tag[0].startsWith("</")) depth--;
    else if (!tag[0].endsWith("/>")) depth++;
    if (depth > 60) throw new Error("Unsupported XML nesting");
  }
  if (XMLValidator.validate(xml) !== true) throw new Error("Invalid QTI XML");
  const item = new XMLParser({ ignoreAttributes:false, removeNSPrefix:true, parseTagValue:false }).parse(xml).assessmentItem;
  if (!item) throw new Error("Unsupported QTI: expected a QTI 2 assessmentItem");
  const choices = find(item.itemBody,"choiceInteraction");
  const entries = find(item.itemBody,"textEntryInteraction");
  if (choices.length + entries.length !== 1) throw new Error("Unsupported QTI: exactly one choice or text entry interaction required");
  const interaction = choices[0] ?? entries[0];
  const declaration = array<any>(item.responseDeclaration).find(d => d["@_identifier"] === interaction["@_responseIdentifier"]);
  if (!declaration || !declaration.correctResponse) throw new Error("Unsupported QTI: missing explicit correct response");
  const processing = item.responseProcessing;
  if (processing && (!processing["@_template"]?.endsWith("/match_correct") || Object.keys(processing).some(k => !k.startsWith("@_"))))
    throw new Error("Unsupported QTI custom response processing");
  const values = array<unknown>(declaration.correctResponse.value).map(v=>text(v));
  const prompt = text(interaction.prompt || item.itemBody.p || item["@_title"]);
  let answer: unknown;
  if (choices.length) {
    if (declaration["@_baseType"] !== "identifier" || !["single","multiple"].includes(declaration["@_cardinality"])) throw new Error("Unsupported QTI choice response type");
    answer = { kind:declaration["@_cardinality"] === "single" ? "multiple_choice" : "multiple_select",
      options:array<any>(interaction.simpleChoice).map(c=>({id:c["@_identifier"],label:text(c)})), correctOptionIds:values };
  } else {
    if (declaration["@_baseType"] !== "string" || declaration["@_cardinality"] !== "single") throw new Error("Unsupported QTI text response type");
    answer={kind:"short_answer",acceptedAnswers:values,caseSensitive:true};
  }
  return universalQuestionSchema.parse({schemaVersion:1,id:randomUUID(),prompt,answer,
    explanation:item.modalFeedback ? text(item.modalFeedback) : undefined,tags:[]});
}
export function parseQti(bytes: Buffer): UniversalQuestion[] {
  const texts = bytes.toString("ascii",0,2) === "PK" ? inspectArchive(bytes)
    .filter(e=>e.name.endsWith(".xml") && !e.name.endsWith("imsmanifest.xml"))
    .map(e=>readText(zipBytes(bytes,e))).filter(xml=>/<(?:\w+:)?assessmentItem\b/.test(xml)) : [readText(bytes)];
  if (!texts.length || texts.length > 500) throw new Error("Unsupported QTI package: 1–500 assessment items required");
  return texts.map(parseItem);
}
const esc = (s: string) => s.replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[c]!));
export function exportQti(questions: UniversalQuestion[]): Buffer {
  if (!questions.length || questions.length > 500) throw new Error("Unsupported QTI export: 1–500 questions required");
  const files: Record<string, Uint8Array> = {};
  const resources: string[]=[];
  questions.forEach((q,i)=>{
    const a=q.answer, id="item_"+(i+1), name=id+".xml";
    let cardinality="single", baseType="identifier", correct:string[], body:string;
    if (a.kind === "multiple_choice" || a.kind === "multiple_select") {
      cardinality=a.kind === "multiple_select" ? "multiple" : "single";
      const ids = new Map(a.options.map((o,i)=>[o.id,"choice_"+(i+1)]));
      correct=a.correctOptionIds.map(v=>ids.get(v)!);
      body='<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="'+(a.kind === "multiple_select"?a.options.length:1)+'"><prompt>'+esc(q.prompt)+'</prompt>'+a.options.map(o=>'<simpleChoice identifier="'+ids.get(o.id)+'">'+esc(o.label)+'</simpleChoice>').join("")+'</choiceInteraction>';
    } else if (["text","short_answer","flashcard"].includes(a.kind)) {
      baseType="string";
      correct=a.kind === "flashcard" ? [a.back] : "acceptedAnswers" in a ? a.acceptedAnswers : [];
      if(correct.length !== 1) throw new Error("Unsupported QTI export: text requires one accepted answer");
      body='<p>'+esc(q.prompt)+' <textEntryInteraction responseIdentifier="RESPONSE"/></p>';
    } else throw new Error("Unsupported QTI export question kind: "+a.kind);
    files[name]=strToU8('<?xml version="1.0" encoding="UTF-8"?><assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="'+id+'" title="'+esc(q.prompt.slice(0,120))+'" adaptive="false" timeDependent="false"><responseDeclaration identifier="RESPONSE" cardinality="'+cardinality+'" baseType="'+baseType+'"><correctResponse>'+correct.map(v=>'<value>'+esc(v)+'</value>').join("")+'</correctResponse></responseDeclaration><outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/><itemBody>'+body+'</itemBody><responseProcessing template="http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct"/>'+ (q.explanation ? '<modalFeedback outcomeIdentifier="FEEDBACK" identifier="explanation" showHide="show">'+esc(q.explanation)+'</modalFeedback>' : '')+'</assessmentItem>');
    resources.push('<resource identifier="'+id+'" type="imsqti_item_xmlv2p1" href="'+name+'"><file href="'+name+'"/></resource>');
  });
  files['imsmanifest.xml']=strToU8('<?xml version="1.0" encoding="UTF-8"?><manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" identifier="trivia_lobby"><organizations/><resources>'+resources.join("")+'</resources></manifest>');
  // Stored ZIP members avoid generating archives that exceed our import ratio budget.
  return Buffer.from(zipSync(files,{level:0}));
}
export function parseAnkiText(content:string): ImportableCard[] {
  const body=content.replace(/^(#[^\r\n]*\r?\n)+/,"");
  const parsed=Papa.parse<string[]>(body,{delimiter:"\t",skipEmptyLines:true});
  if (parsed.errors.length || !parsed.data.length || parsed.data.length > 5000) throw new Error("Invalid Anki tab-separated text");
  return parsed.data.map(row=>{
    if (row.length !== 2 || !row[0].trim() || !row[1].trim() || row.some(v=>v.length>10000)) throw new Error("Invalid Anki Basic note: exactly two nonempty fields required");
    return {front:row[0],back:row[1],type:"flashcard",options:[],correctOption:null};
  });
}
export function exportAnkiText(cards: {front:string;back:string}[]) {
  return '#separator:tab\n#html:false\n#notetype:Basic\n#columns:Front\tBack\n'+Papa.unparse(cards.map(c=>[c.front,c.back]),{delimiter:"\t",newline:"\n",quotes:true});
}
