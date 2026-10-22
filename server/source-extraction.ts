import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import { identifySource, inspectArchive, zipText, xmlToText, textPairs } from "./library-parse";

export type ExtractedSource = { text: string; status: string; pages?: number };
let pdfJobs=0;
/** PDF parsing runs with a memory ceiling and hard timeout away from the HTTP event loop. */
export async function extractSource(filename: string, bytes: Buffer): Promise<ExtractedSource> {
  const { kind } = identifySource(filename, bytes);
  if (["txt", "md", "csv", "tsv", "json"].includes(kind)) return { text: bytes.toString("utf8").slice(0,200000), status: "extracted" };
  if (kind === "docx" || kind === "pptx") {
    const members = inspectArchive(bytes).filter(e => kind === "docx" ? e.name === "word/document.xml" : /^ppt\/slides\/slide\d+\.xml$/.test(e.name));
    const text = members.map(e => xmlToText(zipText(bytes,e))).join("\n").slice(0,200000);
    return { text, status: text.trim() ? "extracted" : "empty" };
  }
  if (kind !== "pdf") return { text: "", status: "manual-only" };
  if(pdfJobs>=2)throw new Error("Source extraction is busy; retry shortly");
  pdfJobs++;
  return new Promise<ExtractedSource>((resolve,reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      (async () => {
        const { getDocumentProxy } = await import(workerData.module);
        const pdf = await getDocumentProxy(new Uint8Array(workerData.bytes), { isEvalSupported:false, useSystemFonts:false, disableFontFace:true });
        let result;
        try {
          if (pdf.numPages > 300) throw new Error('PDF page limit is 300');
          let text = '';
          for (let i=1;i<=pdf.numPages && text.length<200000;i++) {
            const page=await pdf.getPage(i), content=await page.getTextContent();
            text += '\\n[Page '+i+']\\n'+content.items.map(x => x.str ? x.str+(x.hasEOL?'\\n':' ') : '').join('');
            page.cleanup();
          }
          result = { text:text.slice(0,200000), pages:pdf.numPages, status:text.trim()?'extracted':'ocr-required' };
        } finally { await pdf.loadingTask.destroy(); }
        parentPort.postMessage(result);
      })().catch(e => { throw e; });
    `, { eval:true, workerData:{ bytes, module:createRequire(process.cwd()+"/package.json").resolve("unpdf") }, resourceLimits:{ maxOldGenerationSizeMb:128 } });
    const timer=setTimeout(() => { void worker.terminate(); reject(new Error("PDF extraction timed out")); },15000);
    worker.once("message", value => { clearTimeout(timer); resolve(value); void worker.terminate(); });
    worker.once("error", () => { clearTimeout(timer); reject(new Error("PDF extraction failed")); });
    worker.once("exit", () => { clearTimeout(timer); reject(new Error("PDF extraction stopped before returning text")); });
  }).finally(()=>{pdfJobs--;});
}

export async function sourcePreview(filename: string, bytes: Buffer) {
  const extracted = await extractSource(filename,bytes);
  return { ...extracted, cards:textPairs(extracted.text), support:extracted.status };
}
