import { getLocale, loadLocale, setLocale, subscribeLocale, t, translateStatic } from "./i18n.js";

// Translate only first-party, explicitly marked interface copy. Never walk or
// rewrite authored quiz text, player names, form values or gameplay payloads.
loadLocale();
const originalTitle = document.title;
const nav = document.querySelector("nav.page-nav");
if (nav) {
  for (const link of nav.querySelectorAll(".page-nav-links a")) if (!link.dataset.i18n) link.dataset.i18n = link.textContent;
  for (const brand of nav.querySelectorAll(".lobby-brand")) {
    const signature = document.createElement("small"); signature.className = "lobby-language-signature";
    signature.textContent = "English · Español"; signature.setAttribute("aria-hidden", "true");
    const wordmark = brand.querySelector(".lobby-wordmark"); if (wordmark) wordmark.append(signature);
  }
  if (!nav.querySelector("select")) {
    const label = document.createElement("label"); label.className = "party-language identity-language";
    label.append("🌐 "); const caption = document.createElement("span"); caption.textContent = "Language / Idioma";
    const select = document.createElement("select"); select.id = "display-language"; select.setAttribute("aria-label", "Language / Idioma");
    for (const [value, name] of [["en", "English"], ["es", "Español"]]) { const option = document.createElement("option"); option.value = value; option.lang = value; option.textContent = name; select.append(option); }
    select.addEventListener("change", () => setLocale(select.value)); label.append(caption, select); nav.append(label);
  }
}
const partial = document.body.dataset.languageCoverage === "partial";
const authored = document.body.dataset.languageCoverage === "authored";
let note;
if ((partial || authored) && nav) {
  note = document.createElement("p"); note.className = "language-content-note";
  if (partial) note.setAttribute("role", "status");
  nav.after(note);
}
function renderIdentity() {
  document.title = t(originalTitle);
  if (nav) { nav.lang = getLocale(); for (const select of nav.querySelectorAll("select")) select.value = getLocale(); }
  if (partial) {
    const main = document.querySelector("main"); if (main) main.lang = "en";
    if (note) { note.lang = getLocale(); note.hidden = getLocale() !== "es"; note.textContent = t("This tool is currently in English. Your language choice is saved for the game lobby."); }
  }
  if (authored) {
    const main = document.querySelector("main"); if (main) main.lang = getLocale();
    if (note) { note.lang = getLocale(); note.textContent = t("Your quiz content keeps its original wording. Only the editor controls change language."); }
  }
  translateStatic(document);
}
subscribeLocale(renderIdentity);
renderIdentity();
