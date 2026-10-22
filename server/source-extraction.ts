import { Worker } from "node:worker_threads";
import { identifySource, sourceText, textPairs, previewSource } from "./library-parse";
import { parseQti, parseAnkiText } from "./interchange";

// Isolate PDF parsing from the HTTP event loop, with memory, page and time budgets.
export function extractPdf(bytes: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      (async () => {
        const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const task = getDocument({data: new Uint8Array(workerData), isEvalSupported: false,
          useSystemFonts: false, disableFontFace: true, stopAtErrors: true});
        try {
          const doc = await task.promise;
          let text = '';
          for (let n=1; n<=Math.min(doc.numPages,200) && text.length<200000; n++) {
            const page = await doc.getPage(n);
            const content = await page.getTextContent();
            text += '[Page ' + n + ']\\n' + content.items.map(x => x.str === undefined ? '' : x.str + (x.hasEOL ? '\\n' : ' ')).join('') + '\\n';
            page.cleanup();
          }
          parentPort.postMessage({ text: text.slice(0,200000) });
        } finally { await task.destroy(); }
      })().catch(() => parentPort.postMessage({error:'PDF text extraction failed; encrypted or scanned documents may require manual entry'}));
    `, { eval: true, workerData: bytes, resourceLimits: { maxOldGenerationSizeMb: 256 } });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("PDF extraction time limit exceeded")); }, 15_000);
    worker.once("message", msg => {
      clearTimeout(timer); void worker.terminate();
      if (msg.error) reject(new Error(msg.error)); else resolve(msg.text);
    });
    worker.once("error", () => { clearTimeout(timer); reject(new Error("PDF extraction resource limit exceeded")); });
    worker.once("exit", code => { clearTimeout(timer); if (code !== 0) reject(new Error("PDF extraction stopped")); });
  });
}
export async function extractSource(filename: string, bytes: Buffer): Promise<string> {
  return identifySource(filename, bytes).kind === "pdf" ? extractPdf(bytes) : sourceText(filename, bytes);
}
export async function sourcePreview(filename: string, bytes: Buffer, content: string) {
  const kind = identifySource(filename, bytes).kind;
  if (kind === "qti" || kind === "xml") return { cards: [], questions: parseQti(bytes), support: "qti-2-choice-text" };
  if ((kind === "txt" || kind === "tsv") && bytes.toString("utf8").startsWith("#separator:tab")) {
    return { cards: parseAnkiText(bytes.toString("utf8")), support: "anki-text" };
  }
  if (kind === "pdf") return { cards: textPairs(content), support: content.trim() ? "pdf-text-pairs" : "manual-only" };
  return previewSource(filename, bytes);
}
