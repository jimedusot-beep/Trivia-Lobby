import { importRazziaQuiz } from "./razzia-import.js";
// Browser-local Quiz Library. Stored only in this origin's IndexedDB.
export const LOCAL_DB_NAME = "trivia-lobby-local-library";
const VERSION = 1;
const STORE = "decks";
const MAX_DECKS = 30;
export const MAX_QUESTIONS = 20;
const fail = message => { throw new Error(message); };
const clean = (value, max, label) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value))
    fail(`${label} must contain 1–${max} printable characters.`);
  return value.trim();
};
export function validateLocalDeck(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("Invalid quiz.");
  const title = clean(value.title, 80, "Quiz title");
  if (!Array.isArray(value.questions) || !value.questions.length ||
      value.questions.length > MAX_QUESTIONS)
    fail(`A quiz needs 1–${MAX_QUESTIONS} questions.`);
  const questions = value.questions.map((q, index) => {
    if (!q || typeof q !== "object" || Array.isArray(q))
      fail(`Question ${index + 1} is invalid.`);
    if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 4)
      fail(`Question ${index + 1} needs 2–4 choices.`);
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.choices.length)
      fail(`Question ${index + 1}: choose the correct answer.`);
    if (typeof q.explanation !== "string" || q.explanation.length > 240)
      fail(`Question ${index + 1}: explanation must be 240 characters or fewer.`);
    for (const [key,min,max] of [["seconds",5,120],["points",0,100000],["penalty",0,100000]]) {
      if (q[key] !== undefined && (!Number.isInteger(q[key]) || q[key] < min || q[key] > max)) fail(`Question ${index + 1}: invalid ${key}.`);
    }
    return {
      prompt: clean(q.prompt, 200, `Question ${index + 1}`),
      choices: q.choices.map((v, i) => clean(v, 120, `Answer ${i + 1}`)),
      correct: q.correct,
      explanation: q.explanation.trim(),
      ...(q.seconds !== undefined ? { seconds: q.seconds } : {}),
      ...(q.points !== undefined ? { points: q.points } : {}),
      ...(q.penalty !== undefined ? { penalty: q.penalty } : {}),
    };
  });
  return { title, questions };
}
export function backupGuestDeck(deck) {
  const safe = validateLocalDeck(deck);
  return JSON.stringify({ format: "trivia-lobby-local-quiz", version: 1, deck: safe }, null, 2);
}
const csvField = value => `"${String(value).replaceAll('"', '""')}"`;
export function csvGuestDeck(deck) {
  const { questions } = validateLocalDeck(deck);
  return [
    ["Question", "OptionA", "OptionB", "OptionC", "OptionD", "Correct", "Explanation"].join(","),
    ...questions.map(q => [
      q.prompt, q.choices[0], q.choices[1], q.choices[2] ?? "", q.choices[3] ?? "",
      String.fromCharCode(65 + q.correct), q.explanation,
    ].map(csvField).join(",")),
  ].join("\r\n") + "\r\n";
}
export function parseDelimited(content, delimiter) {
  const rows = [], row = [];
  let field = "", quote = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (quote) {
      if (c === '"') {
        if (content[i + 1] === '"') { field += '"'; i++; }
        else quote = false;
      } else field += c;
    } else if (c === '"' && !field.length) quote = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && content[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(v => v.trim())) rows.push(row.splice(0));
      else row.length = 0;
    } else field += c;
  }
  if (quote) fail("Unclosed quoted field.");
  row.push(field);
  if (row.some(v => v.trim())) rows.push(row);
  if (rows.length > MAX_QUESTIONS + 1) fail(`Import at most ${MAX_QUESTIONS} questions at a time.`);
  return rows;
}
export function importGuestDeck(name, input) {
  if (typeof input !== "string" || new TextEncoder().encode(input).byteLength > 128 * 1024)
    fail("The quiz file must be 128 KB or smaller.");
  if (/\.json$/i.test(name)) {
    let parsed;
    try { parsed = JSON.parse(input); }
    catch { fail("This is not valid JSON."); }
    if (parsed && Object.hasOwn(parsed,"subject") && Object.hasOwn(parsed,"questions")) return validateLocalDeck(importRazziaQuiz(parsed));
    if (parsed?.format !== "trivia-lobby-local-quiz" || parsed?.version !== 1)
      fail("Choose a Trivia Lobby local quiz JSON backup.");
    return validateLocalDeck(parsed.deck);
  }
  const type = name.toLowerCase();
  if (!/\.(csv|tsv|txt)$/.test(type)) fail("Use CSV, TSV, TXT, or a Trivia Lobby JSON backup.");
  const delimiter = type.endsWith(".txt") ? "|" : type.endsWith(".tsv") ? "\t" : ",";
  const rows = parseDelimited(input.replace(/^\uFEFF/, ""), delimiter);
  if (rows.length < 2) fail("Include a header and at least one question.");
  const header = rows.shift().map(x => x.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const idx = (...options) => header.findIndex(x => options.includes(x));
  const questionColumn = idx("question", "front", "prompt");
  const columns = [idx("optiona", "choicea", "answer1"), idx("optionb", "choiceb", "answer2"), idx("optionc", "choicec", "answer3"), idx("optiond", "choiced", "answer4")];
  const correctColumn = idx("correct", "correctoption", "correctanswer");
  const explainColumn = idx("explanation", "back", "reason");
  if (questionColumn < 0 || correctColumn < 0 || columns[0] < 0 || columns[1] < 0)
    fail("Required columns: Question, OptionA, OptionB, Correct. OptionC, OptionD and Explanation are optional.");
  const questions = rows.map((r, rowIndex) => {
    const slots = columns.map(i => (i === -1 ? "" : (r[i] ?? "").trim()));
    const gap = slots.findIndex(x => !x);
    if (gap !== -1 && slots.slice(gap + 1).some(Boolean))
      fail(`Row ${rowIndex + 2}: answer options must start at A with no gaps.`);
    const choices = slots.filter(Boolean);
    const rawCorrect = (r[correctColumn] || "").trim();
    const letter = rawCorrect.toUpperCase();
    const correct = /^[A-D]$/.test(letter) ? letter.charCodeAt(0) - 65
      : /^\d+$/.test(letter) ? Number(letter) - 1
        : choices.findIndex(x => x.toLowerCase() === rawCorrect.toLowerCase());
    return {
      prompt: r[questionColumn] || "",
      choices,
      correct,
      explanation: explainColumn < 0 ? "" : (r[explainColumn] || ""),
    };
  });
  return validateLocalDeck({ title: name.replace(/\.(csv|tsv|txt)$/i, "").replace(/[_-]/g, " "), questions });
}
const openDatabase = () => new Promise((resolve, reject) => {
  if (typeof indexedDB === "undefined") { reject(new Error("Device storage is unavailable.")); return; }
  const req = indexedDB.open(LOCAL_DB_NAME, VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error || new Error("Cannot open local quiz storage."));
  req.onblocked = () => reject(new Error("Local storage is blocked by another tab."));
});
function operation(mode, work) {
  return openDatabase().then(db => new Promise((resolve, reject) => {
    let result;
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    try { work(store, value => { result = value; }); }
    catch (e) { db.close(); reject(e); return; }
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("Local quiz storage failed.")); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error("Local quiz storage cancelled.")); };
  }));
}
export async function listGuestDecks() {
  const decks = await operation("readonly", (store, done) => { store.getAll().onsuccess = e => done(e.target.result); });
  return decks.sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function getGuestDeck(id) {
  if (typeof id !== "string" || !/^[\w-]{8,80}$/.test(id)) return null;
  return (await operation("readonly", (store, done) => { store.get(id).onsuccess = e => done(e.target.result ?? null); })) ?? null;
}
export async function saveGuestDeck(data) {
  const cleanDeck = validateLocalDeck(data);
  const id = typeof data.id === "string" && /^[\w-]{8,80}$/.test(data.id) ? data.id : crypto.randomUUID();
  const record = { ...cleanDeck, id, updatedAt: Date.now() };
  return operation("readwrite", (store, done) => {
    const all = store.getAllKeys();
    all.onsuccess = () => {
      if (!all.result.includes(id) && all.result.length >= MAX_DECKS) {
        store.transaction.abort();
        return;
      }
      store.put(record);
      done(record);
    };
  }).catch(err => {
    if (err?.name === "AbortError") fail(`You can save up to ${MAX_DECKS} local quizzes. Export and remove one first.`);
    throw err;
  });
}
export function removeGuestDeck(id) {
  return operation("readwrite", (store, done) => { store.delete(id); done(true); });
}

// Restore learning backups atomically within the quiz library. Never overwrite
// different existing content, even when a backup reuses its ID.
export function restoreGuestDecks(records) {
  if (!Array.isArray(records) || records.length > MAX_DECKS) fail("Too many quizzes in learning backup.");
  const safe = records.map(record => {
    if (!/^[\w-]{8,80}$/.test(record?.id)) fail("Invalid backup quiz ID.");
    return { id: record.id, ...validateLocalDeck(record) };
  });
  if (new Set(safe.map(record => record.id)).size !== safe.length) fail("Duplicate backup quiz ID.");
  let reason;
  return operation("readwrite", (store, done) => {
    store.getAll().onsuccess = event => {
      try {
      const current = event.target.result;
      const existing = new Map(current.map(record => [record.id, record]));
      const conflict = safe.find(record => existing.has(record.id) &&
        JSON.stringify(validateLocalDeck(existing.get(record.id))) !== JSON.stringify(validateLocalDeck(record)));
      if (conflict || current.length + safe.filter(record => !existing.has(record.id)).length > MAX_DECKS) {
        reason = conflict ? `A different version of "${conflict.title}" already exists on this device. No quizzes were changed.`
          : `Restore would exceed ${MAX_DECKS} local quizzes. No quizzes were changed.`;
        store.transaction.abort(); return;
      }
      for (const record of safe) {
        if (!existing.has(record.id)) store.put({ ...record, updatedAt: Date.now() });
      }
      done(safe.length);
      } catch (error) { reason = error.message; store.transaction.abort(); }
    };
  }).catch(error => { throw new Error(reason || error.message || "Quiz restoration failed."); });
}
