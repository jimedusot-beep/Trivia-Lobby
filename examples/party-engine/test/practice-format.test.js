import test from "node:test";
import assert from "node:assert/strict";
import { setLocale, formatText } from "../public/i18n.js";

test("UI formatting retains zero counts and literal authored values without translating or re-expanding them", () => {
  const title = 'Home {current} <script> — Mars';
  try {
    for (const language of ["en", "es"]) {
      setLocale(language);
      assert.equal(formatText("{title}", { title }), title);
      assert.equal(formatText("Question {current} of {total}", { current:0, total:2 }), language === "es" ? "Pregunta 0 de 2" : "Question 0 of 2");
      assert.equal(formatText("{missing}", {}), "{missing}");
    }
  } finally { setLocale("en"); }
});
