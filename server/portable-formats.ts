import { randomUUID } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import Papa from "papaparse";
import initSqlJs from "sql.js";
import { universalQuestionSchema, type UniversalQuestion } from "@shared/universal-questions";
import { inspectArchive, readArchiveMember, zipText, xmlToText } from "./library-parse";

const array = <T>(v: T | T[] | undefined): T[] => v === undefined ? [] : Array.isArray(v) ? v : [v];
const text = (v: unknown): string => typeof v === "string" || typeof v === "number" ? String(v) : v && typeof v === "object" ? Object.entries(v).filter(([k]) => !k.startsWith("@")).map(([,x])=>text(x)).join(" ").trim() : "";
const xml = (v: string) => v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");

/** Deliberately strict QTI 2.1 item subset: single-choice and plain short answers. */
export function parseQti(content: string): UniversalQuestion[] {
  if (content.length > 2*1024*1024 || /<!DOCTYPE|<!ENTITY|<script\b/i.test(content)) throw new Error("Unsafe or oversized QTI XML");
  if (XMLValidator.validate(content) !== true) throw new Error("Invalid QTI XML");
  const parsed = new XMLParser({ ignoreAttributes:false, removeNSPrefix:true, parseTagValue:false }).parse(content);
  const item = parsed.assessmentItem;
  if (!item || item["@_adaptive"] === "true") throw new Error("Unsupported QTI item; expected a non-adaptive QTI 2.1 assessmentItem");
  const declarations = array<any>(item.responseDeclaration);
  const choice = item.itemBody?.choiceInteraction, entry = item.itemBody?.textEntryInteraction;
  if ((!choice && !entry) || (choice && entry)) throw new Error("Unsupported QTI interaction");
  const interaction = choice ?? entry;
  const declaration = declarations.find(d => d["@_identifier"] === interaction["@_responseIdentifier"]);
  if (!declaration || declaration["@_cardinality"] !== "single") throw new Error("Unsupported QTI response cardinality");
  const values = array(declaration.correctResponse?.value).map(text);
  if (values.length !== 1 || !values[0]) throw new Error("Invalid QTI correct response");
  const answer = choice ? { kind:"multiple_choice", options:array<any>(choice.simpleChoice).map(c => ({ id:c["@_identifier"], label:text(c) })), correctOptionIds:values }
    : { kind:"short_answer", acceptedAnswers:values, caseSensitive:false };
  const prompt = text(choice?.prompt ?? item.itemBody?.p ?? item["@_title"]);
  return [universalQuestionSchema.parse({ schemaVersion:1, id:randomUUID(), prompt, answer,
    explanation:text(item.modalFeedback) || undefined, tags:[], source:{ attribution:"Imported QTI item " + String(item["@_identifier"]??"") } })];
}
export function parseQtiFile(bytes: Buffer): UniversalQuestion[] {
  if (bytes.toString("ascii",0,2) !== "PK") return parseQti(bytes.toString("utf8"));
  const entries = inspectArchive(bytes).filter(e => /\.xml$/i.test(e.name) && !/(^|\/)imsmanifest\.xml$/i.test(e.name));
  const questions: UniversalQuestion[] = [];
  for (const e of entries) {
    const content=zipText(bytes,e);
    if (/<(?:\w+:)?assessmentItem\b/.test(content)) questions.push(...parseQti(content));
  }
  if (!questions.length || questions.length > 500) throw new Error("QTI package requires 1–500 supported items");
  return questions;
}
export function exportQti(question: UniversalQuestion): string {
  const a=question.answer;
  if (!["multiple_choice","text","short_answer","flashcard"].includes(a.kind)) throw new Error("This question kind needs the lossless JSON export; QTI export supports single-choice and short answers");
  const id="q_"+question.id.replace(/[^A-Za-z0-9_]/g,"_");
  let value:string, body:string, baseType:string;
  if (a.kind === "multiple_choice") {
    value=a.correctOptionIds[0]; baseType="identifier";
    body=`<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><prompt>${xml(question.prompt)}</prompt>${a.options.map(o=>`<simpleChoice identifier="${xml(o.id)}">${xml(o.label)}</simpleChoice>`).join("")}</choiceInteraction>`;
  } else {
    const accepted=a.kind === "flashcard" ? [a.back] : "acceptedAnswers" in a ? a.acceptedAnswers : [];
    if (accepted.length !== 1) throw new Error("QTI short-answer export requires exactly one accepted answer");
    value=accepted[0]; baseType="string";
    body=`<p>${xml(question.prompt)}</p><textEntryInteraction responseIdentifier="RESPONSE"/>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="${id}" title="${xml(question.prompt.slice(0,120))}" adaptive="false" timeDependent="false"><responseDeclaration identifier="RESPONSE" cardinality="single" baseType="${baseType}"><correctResponse><value>${xml(value)}</value></correctResponse></responseDeclaration><itemBody>${body}</itemBody><responseProcessing template="http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct"/></assessmentItem>`;
}
export function exportAnkiTsv(cards: {front:string;back:string}[]): string {
  return "#separator:Tab\n#html:false\n"+Papa.unparse(cards.map(c=>[c.front,c.back]),{ delimiter:"\t", header:false });
}
export function parseAnkiTsv(content: string) {
  const rows=Papa.parse<string[]>(content.split(/\r?\n/).filter(line=>!line.startsWith("#")).join("\n"),{ delimiter:"\t",skipEmptyLines:true });
  if (rows.errors.length || rows.data.length>5000 || rows.data.some(r=>r.length!==2 || !r[0]?.trim() || !r[1]?.trim())) throw new Error("Invalid two-column Anki text file");
  return rows.data.map(([front,back])=>({ front,back,type:"flashcard" as const,options:[],correctOption:null }));
}
export async function parseApkg(bytes: Buffer) {
  const entries=inspectArchive(bytes);
  const collection=entries.find(e=>e.name === "collection.anki21" || e.name === "collection.anki2");
  if (!collection) throw new Error("Unsupported APKG version; export legacy-compatible APKG or two-column Anki text");
  const data=readArchiveMember(bytes,collection);
  if (data.toString("ascii",0,15)!=="SQLite format 3") throw new Error("Invalid Anki SQLite collection");
  const SQL=await initSqlJs(); const database=new SQL.Database(data);
  try {
    database.run("PRAGMA query_only=ON; PRAGMA trusted_schema=OFF");
    const meta=database.exec("SELECT type FROM sqlite_master WHERE name='notes'");
    if (meta[0]?.values[0]?.[0] !== "table") throw new Error("Invalid Anki notes table");
    const result=database.exec("SELECT flds FROM notes LIMIT 5001");
    const notes=result[0]?.values??[];
    if (!notes.length || notes.length>5000) throw new Error("Anki import requires 1–5000 notes");
    return notes.map(row=>{
      const fields=String(row[0]).split("\x1f");
      if(fields.length!==2 || fields.some(f=>/<img\b|\[sound:|\{\{c\d+::/i.test(f))) throw new Error("Unsupported Anki note; only basic two-field text notes are converted. The original is retained.");
      const [front,back]=fields.map(f=>xmlToText(f.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,"")).trim());
      if(!front||!back||front.length>10000||back.length>10000)throw new Error("Invalid Anki note text");
      return {front,back,type:"flashcard" as const,options:[],correctOption:null};
    });
  } finally { database.close(); }
}
