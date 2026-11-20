import {
  MAX_QUESTIONS, listGuestDecks, getGuestDeck, saveGuestDeck, removeGuestDeck,
  validateLocalDeck, backupGuestDeck, csvGuestDeck, importGuestDeck,
} from "./guest-decks.js";
import { getLocale, loadLocale, subscribeLocale } from "./i18n.js";
import { creatorText, creatorError } from "./creator-copy.js";

loadLocale();
const $ = id => document.getElementById(id);
const copy = (key, values = {}) => creatorText(key, values, getLocale());
const answerIds = ["answer-a", "answer-b", "answer-c", "answer-d"];
let draft = { title: "", questions: [] };
let editIndex = -1;
let latestStatus = { key: "Checking device storage…", values: {} };
const renderStatus = () => { $("status").textContent = latestStatus.error ? creatorError(latestStatus.error.message, latestStatus.error.name, getLocale()) : copy(latestStatus.key, latestStatus.values); };
const say = (key, values = {}) => { latestStatus = { key, values }; renderStatus(); };
const element = (tag, content, parent) => {
  const e = document.createElement(tag);
  if (content !== undefined) e.textContent = content;
  parent.append(e);
  return e;
};
const action = (label, parent, callback, disabled = false) => {
  const b = element("button", label, parent);
  b.type = "button";
  b.disabled = disabled;
  b.addEventListener("click", callback);
  return b;
};
function resetEditor() {
  editIndex = -1;
  $("question-form").reset();
  for (const field of $("question-form").elements) if (field.setCustomValidity) field.setCustomValidity("");
  renderEditorLabels();
  $("cancel-edit").hidden = true;
}
function renderEditorLabels() {
  $("form-heading").textContent = editIndex < 0 ? copy("Add question") : copy("Edit question {number}", { number: editIndex + 1 });
  $("add-question").textContent = copy(editIndex < 0 ? "Add question" : "Update question");
}
function renderQuestions() {
  const root = $("question-list");
  root.replaceChildren();
  $("count").textContent = `${draft.questions.length} / ${MAX_QUESTIONS}`;
  for (let index = 0; index < draft.questions.length; index++) {
    const q = draft.questions[index];
    const li = element("li", undefined, root);
    const summary = element("div", undefined, li);
    element("strong", `${index + 1}. ${q.prompt}`, summary).lang = "";
    const answer = element("p", undefined, summary);
    element("span", copy("Correct: {letter} · ", { letter: String.fromCharCode(q.correct + 65) }), answer);
    element("span", q.choices[q.correct], answer).lang = "";
    const controls = element("div", undefined, li);
    controls.className = "question-actions";
    action(copy("Edit question {number}", { number:index + 1 }), controls, () => editQuestion(index));
    action(copy("Move question {number} up", { number:index + 1 }), controls, () => moveQuestion(index, -1), index === 0);
    action(copy("Move question {number} down", { number:index + 1 }), controls, () => moveQuestion(index, 1), index === draft.questions.length - 1);
    action(copy("Remove question {number}", { number:index + 1 }), controls, () => {
      draft.questions.splice(index, 1);
      resetEditor();
      renderQuestions();
      say("Unsaved changes. Select Save quiz when you are ready.");
    });
  }
}
function editQuestion(index) {
  const q = draft.questions[index];
  editIndex = index;
  $("prompt").value = q.prompt;
  answerIds.forEach((id, i) => { $(id).value = q.choices[i] || ""; });
  $("correct").value = String(q.correct);
  $("explanation").value = q.explanation || "";
  renderEditorLabels();
  $("cancel-edit").hidden = false;
  $("prompt").focus();
}
function moveQuestion(index, delta) {
  const swap = index + delta;
  if (swap < 0 || swap >= draft.questions.length) return;
  [draft.questions[index], draft.questions[swap]] = [draft.questions[swap], draft.questions[index]];
  resetEditor();
  renderQuestions();
  say("Question reordered. Save quiz to preserve this change.");
}
let savedRender = 0;
async function renderSaved() {
  const token = ++savedRender;
  const root = $("saved-list");
  const records = await listGuestDecks();
  if (token !== savedRender) return;
  root.replaceChildren();
  if (!records.length) { element("p", copy("No saved quizzes yet. Make your first one below."), root); return; }
  const list = element("ul", undefined, root);
  for (const item of records) {
    const li = element("li", undefined, list);
    const edit = action("", li, () => {
      load(item);
      $("edit-title").scrollIntoView({ behavior: "smooth" });
    });
    element("span", item.title, edit).lang = "";
    element("span", copy(" · {count} questions · Edit", { count:item.questions.length }), edit);
    const learn = element("a", undefined, li);
    element("span", copy("Learn "), learn);
    element("span", item.title, learn).lang = "";
    const url = new URL("./learn.html", location.href);
    url.searchParams.set("deck", item.id);
    learn.href = url.href;
  }
}
function load(record) {
  draft = { id: record.id, title: record.title, questions: structuredClone(record.questions) };
  $("quiz-title").value = draft.title;
  resetEditor();
  renderQuestions();
  say("Loaded {title}. Saved on this device.", { title:draft.title });
}
function readDraft() {
  draft.title = $("quiz-title").value.trim();
  return validateLocalDeck(draft);
}
async function save() {
  const valid = readDraft();
  const record = await saveGuestDeck({ ...valid, ...(draft.id ? { id: draft.id } : {}) });
  draft.id = record.id;
  await renderSaved();
  say('Saved "{title}" on this device. Download a JSON backup to keep a separate copy.', { title:valid.title });
  return record;
}
function download(filename, mime, data) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function filename(ext) {
  const name = draft.title.replace(/[^\w-]+/g, "-").slice(0,50) || "guest-quiz";
  return `${name}.${ext}`;
}
function attempt(fn) {
  Promise.resolve().then(fn).catch(err => {
    latestStatus = { error: { message: typeof err?.message === "string" ? err.message : "", name:err?.name } };
    renderStatus();
  });
}
$("question-form").addEventListener("submit", event => {
  event.preventDefault();
  attempt(() => {
    if (editIndex === -1 && draft.questions.length >= MAX_QUESTIONS)
      throw new Error(`Maximum ${MAX_QUESTIONS} questions per guest party quiz.`);
    const raw = answerIds.map(id => $(id).value.trim());
    const firstMissing = raw.findIndex(x => !x);
    if (firstMissing !== -1 && raw.slice(firstMissing + 1).some(Boolean))
      throw new Error("Fill answers in order starting with A and B. Leave only the last answers blank.");
    const choices = raw.filter(Boolean);
    const correct = Number($("correct").value);
    const previous = editIndex >= 0 ? draft.questions[editIndex] : {};
    const single = {
      ...Object.fromEntries(["seconds","points","penalty"].filter(key=>previous[key] !== undefined).map(key=>[key,previous[key]])),
      prompt: $("prompt").value,
      choices,
      correct,
      explanation: $("explanation").value,
    };
    const question = validateLocalDeck({ title: "Draft", questions: [single] }).questions[0];
    if (editIndex < 0) draft.questions.push(question);
    else draft.questions[editIndex] = question;
    resetEditor();
    renderQuestions();
    say("Question added. Select Save quiz when you are ready.");
  });
});
$("cancel-edit").addEventListener("click", resetEditor);
$("quiz-title").addEventListener("input", () => {
  draft.title = $("quiz-title").value;
  say("Unsaved title change. Select Save quiz when finished.");
});
$("new-quiz").addEventListener("click", () => {
  if (draft.questions.length && !confirm(copy("Start a new quiz? Export or save your current edits first."))) return;
  draft = { title: "", questions: [] };
  $("quiz-title").value = "";
  resetEditor();
  renderQuestions();
  say("New quiz started. Questions will save on this device only.");
});
$("save-quiz").addEventListener("click", () => attempt(save));
$("host-quiz").addEventListener("click", () => attempt(async () => {
  const record = await save();
  const target = new URL("./", location.href);
  target.searchParams.set("deck", record.id);
  location.assign(target.href);
}));
$("practice-quiz").addEventListener("click", () => attempt(async () => {
  const record = await save();
  const target = new URL("./practice.html", location.href);
  target.searchParams.set("deck", record.id);
  location.assign(target.href);
}));
$("learn-quiz").addEventListener("click", () => attempt(async () => {
  const record = await save();
  const target = new URL("./learn.html", location.href);
  target.searchParams.set("deck", record.id);
  location.assign(target.href);
}));
$("backup-quiz").addEventListener("click", () => attempt(() => download(filename("json"), "application/json", backupGuestDeck(readDraft()))));
$("csv-quiz").addEventListener("click", () => attempt(() => download(filename("csv"), "text/csv", csvGuestDeck(readDraft()))));
$("delete-quiz").addEventListener("click", () => attempt(async () => {
  if (!draft.id) {
    say("This quiz hasn't been saved yet.");
    return;
  }
  if (!confirm(copy('Delete "{title}" from this device? Export first if you want a backup.', { title:draft.title }))) return;
  await removeGuestDeck(draft.id);
  draft = { title: "", questions: [] };
  $("quiz-title").value = "";
  resetEditor();
  renderQuestions();
  await renderSaved();
  say("Local quiz deleted.");
}));
$("import-file").addEventListener("change", event => attempt(async () => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 128 * 1024) throw new Error("Import file must be 128 KB or smaller.");
  const data = importGuestDeck(file.name, await file.text());
  // Imported decks receive a new ID and never overwrite an existing quiz.
  const record = await saveGuestDeck(data);
  load(record);
  await renderSaved();
  say("Imported {count} questions. Saved on this device. Download a JSON backup when ready.", { count:record.questions.length });
  event.target.value = "";
}));
$("question-form").addEventListener("invalid", event => {
  event.target.setCustomValidity(copy("Complete this field."));
  say("Complete all required fields before adding the question.");
}, true);
$("question-form").addEventListener("input", event => { if (event.target.setCustomValidity) event.target.setCustomValidity(""); });
subscribeLocale(() => {
  renderEditorLabels(); renderQuestions(); renderStatus();
  for (const field of $("question-form").elements) if (field.validity?.customError) field.setCustomValidity(copy("Complete this field."));
  attempt(renderSaved);
});
renderEditorLabels(); renderQuestions(); renderStatus();
attempt(async () => {
  await renderSaved();
  const id = new URLSearchParams(location.search).get("edit");
  if (id) {
    const record = await getGuestDeck(id);
    if (record) { load(record); return; }
  }
  say("Ready. Start a quiz below, or open one you previously saved.");
});
