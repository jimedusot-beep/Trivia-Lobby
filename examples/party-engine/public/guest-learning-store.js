import { emptyProgress, validateProgress, validateSession, completeLesson, mergeProgress } from "./guest-learning.js";

const DB = "trivia-lobby-local-learning", STORE = "records";
const open = () => new Promise((resolve, reject) => {
  if (typeof indexedDB === "undefined") { reject(new Error("Device storage is unavailable.")); return; }
  const request = indexedDB.open(DB, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error("Cannot open learning storage."));
  request.onblocked = () => reject(new Error("Learning storage is blocked by another tab."));
});
async function transaction(mode, work) {
  const db = await open();
  return new Promise((resolve, reject) => {
    let result, failure;
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const guard = fn => (...args) => {
      try { fn(...args); } catch (err) { failure = err; tx.abort(); }
    };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(failure || tx.error || new Error("Learning save failed.")); };
    guard(work)(store, value => { result = value; }, guard);
  });
}
export function loadLearningProgress() {
  return transaction("readonly", (store, done, guard) => {
    store.get("progress").onsuccess = guard(event => done(event.target.result ? validateProgress(event.target.result.value) : emptyProgress()));
  });
}
export function loadLearningSession(course) {
  return transaction("readonly", (store, done, guard) => {
    store.get(`session:${course.id}`).onsuccess = guard(event => {
      const value = event.target.result?.value;
      if (!value || value.courseKey !== course.key) { done({ session: null, changed: !!value }); return; }
      done({ session: validateSession(value, course), changed: false });
    });
  });
}
export function saveLearningSession(course, session) {
  const value = validateSession(session, course);
  return transaction("readwrite", (store, done) => {
    store.put({ key: `session:${course.id}`, value }); done(value);
  });
}
export function finishLearningSession(course, session) {
  return transaction("readwrite", (store, done, guard) => {
    store.get("progress").onsuccess = guard(event => {
      const value = event.target.result?.value ?? emptyProgress();
      const result = completeLesson(value, course, session);
      store.put({ key: "progress", value: result.progress });
      store.put({ key: `session:${course.id}`, value: validateSession(session, course) });
      done(result);
    });
  });
}
export function restoreLearningProgress(incoming) {
  const safe = validateProgress(incoming);
  return transaction("readwrite", (store, done, guard) => {
    store.get("progress").onsuccess = guard(event => {
      const merged = mergeProgress(event.target.result?.value ?? emptyProgress(), safe);
      store.put({ key: "progress", value: merged });
      done(merged);
    });
  });
}
