import test from "node:test";
import assert from "node:assert/strict";
import { extractSource,sourcePreview } from "./source-extraction";
function pdf(text:string){
  const stream=`BT /F1 12 Tf 50 750 Td (${text}) Tj ET`;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let out='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;});
  const xref=Buffer.byteLength(out);out+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(out);
}
test("bounded PDF worker extracts exact source text with page markers and reviewable pairs",async()=>{
  const bytes=pdf("Question :: Answer"),text=await extractSource("lecture.pdf",bytes);
  assert.match(text,/\[Page 1\]/);assert.match(text,/Question :: Answer/);
  const preview=await sourcePreview("lecture.pdf",bytes,text);assert.equal(preview.cards[0].front,"Question");assert.equal(preview.cards[0].back,"Answer");
});
