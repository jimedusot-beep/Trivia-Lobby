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
  if(item.responseProcessing && item.responseProcessing["@_template"]!=="http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct")throw new Error("Unsupported custom QTI response processing");
  const declaration = declarations.find(d => d["@_identifier"] === interaction["@_responseIdentifier"]);
  if (!declaration || declaration["@_cardinality"] !== "single") throw new Error("Unsupported QTI response cardinality");
  const values = array(declaration.correctResponse?.value).map(text);
  if (values.length !== 1 || !values[0]) throw new Error("Invalid QTI correct response");
  const answer = choice ? { kind:"multiple_choice", options:array<any>(choice.simpleChoice).map(c => ({ id:c["@_identifier"], label:text(c) })), correctOptionIds:values }
    : { kind:"short_answer", acceptedAnswers:values, caseSensitive:true };
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
    if("caseSensitive" in a&&!a.caseSensitive)throw new Error("QTI text export requires exact case-sensitive matching; use JSON to preserve case-insensitive answers");
    value=accepted[0]; baseType="string";
    body=`<p>${xml(question.prompt)}</p><textEntryInteraction responseIdentifier="RESPONSE"/>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="${id}" title="${xml(question.prompt.slice(0,120))}" adaptive="false" timeDependent="false"><responseDeclaration identifier="RESPONSE" cardinality="single" baseType="${baseType}"><correctResponse><value>${xml(value)}</value></correctResponse></responseDeclaration><outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration><itemBody>${body}</itemBody><responseProcessing template="http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct"/></assessmentItem>`;
}

/** Original stored-ZIP writer for fixed export paths; no extraction or filesystem access. */
export function storedZip(files:Record<string,Buffer>):Buffer{
 const local:Buffer[]=[],directory:Buffer[]=[];let offset=0;
 const crc32=(bytes:Buffer)=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
 for(const [name,body] of Object.entries(files)){
  if(!/^[A-Za-z0-9_.-]+$/.test(name))throw new Error("Unsafe export filename");
  const file=Buffer.from(name),crc=crc32(body),header=Buffer.alloc(30),central=Buffer.alloc(46);
  header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt32LE(crc,14);header.writeUInt32LE(body.length,18);header.writeUInt32LE(body.length,22);header.writeUInt16LE(file.length,26);
  central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(body.length,20);central.writeUInt32LE(body.length,24);central.writeUInt16LE(file.length,28);central.writeUInt32LE(offset,42);
  local.push(header,file,body);directory.push(central,file);offset+=header.length+file.length+body.length;
 }
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(directory.reduce((n,b)=>n+b.length,0),12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,...directory,end]);
}
export function exportQtiPackage(questions:UniversalQuestion[]):Buffer{
 if(!questions.length||questions.length>500)throw new Error("QTI export requires 1–500 supported questions");
 const files:Record<string,Buffer>={};
 questions.forEach((q,i)=>{files[`item-${i+1}.xml`]=Buffer.from(exportQti(q));});
 files["imsmanifest.xml"]=Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" identifier="trivia_export"><organizations/><resources>${questions.map((_,i)=>`<resource identifier="item_${i+1}" type="imsqti_item_xmlv2p1" href="item-${i+1}.xml"><file href="item-${i+1}.xml"/></resource>`).join("")}</resources></manifest>`);
 return storedZip(files);
}
export function exportAnkiTsv(cards: {front:string;back:string}[]): string {
  return "#separator:Tab\n#html:false\n"+Papa.unparse(cards.map(c=>[c.front,c.back]),{ delimiter:"\t", header:false,quotes:true });
}
export function parseAnkiTsv(content: string) {
  const lines=content.split(/\r?\n/);while(lines[0]?.startsWith("#"))lines.shift();
  const rows=Papa.parse<string[]>(lines.join("\n"),{ delimiter:"\t",skipEmptyLines:true });
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
    const collectionMeta=database.exec("SELECT type FROM sqlite_master WHERE name='col'");
    if(collectionMeta[0]?.values[0]?.[0]!=="table")throw new Error("Invalid Anki collection table");
    const modelRows=database.exec("SELECT models FROM col LIMIT 1");
    const models=JSON.parse(String(modelRows[0]?.values[0]?.[0]??"{}"));
    const result=database.exec("SELECT mid,flds FROM notes LIMIT 5001");
    const notes=result[0]?.values??[];
    if (!notes.length || notes.length>5000) throw new Error("Anki import requires 1–5000 notes");
    return notes.map(row=>{
      const model=models[String(row[0])];
      if(!model||model.type!==0||model.flds?.length!==2||model.flds[0].name!=="Front"||model.flds[1].name!=="Back"||model.tmpls?.length!==1||xmlToText(model.tmpls[0].qfmt??"").trim()!=="{{Front}}"||!String(model.tmpls[0].afmt??"").includes("{{Back}}"))throw new Error("Unsupported custom Anki note model; export two-column text instead");
      const fields=String(row[1]).split("\x1f");
      if(fields.length!==2 || fields.some(f=>/<img\b|\[sound:|\{\{c\d+::/i.test(f))) throw new Error("Unsupported Anki note; only basic two-field text notes are converted. The original is retained.");
      const [front,back]=fields.map(f=>xmlToText(f.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,"")).trim());
      if(!front||!back||front.length>10000||back.length>10000)throw new Error("Invalid Anki note text");
      return {front,back,type:"flashcard" as const,options:[],correctOption:null};
    });
  } finally { database.close(); }
}
