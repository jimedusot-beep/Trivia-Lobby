// SPDX-License-Identifier: AGPL-3.0-or-later
import { defaultShow, validateShow, importShow } from "./show-format.js";
const $ = (id) => document.getElementById(id),
  say = (text) => ($("show-status").textContent = text),
  key = "trivia-lobby-show-v1";
let show = structuredClone(defaultShow);
try {
  const stored = localStorage.getItem(key);
  if (stored) show = validateShow(JSON.parse(stored));
} catch {
  say("Could not read a saved show. The sample is ready to edit.");
}
const e = (tag, text, parent) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  parent.append(n);
  return n;
};
function field(parent, label, value, id, multiline = false) {
  const caption = e("label", label, parent),
    input = e(multiline ? "textarea" : "input", undefined, parent);
  input.id = id;
  caption.htmlFor = id;
  input.value = value;
  if (multiline) {
    input.rows = 5;
    input.maxLength = 1000;
  } else input.maxLength = 200;
  return input;
}
function render() {
  $("show-title").value = show.title;
  for (const [target, questions, final] of [
    ["show-rounds", show.rounds, false],
    ["show-final", show.final, true],
  ]) {
    const root = $(target);
    root.replaceChildren();
    questions.forEach((q, index) => {
      const box = e("article", undefined, root);
      box.className = "board-table";
      e("h3", `${final ? "Lightning question" : "Board"} ${index + 1}`, box);
      field(box, "Question", q.question, `${target}-question-${index}`);
      field(
        box,
        "Answers and points — one answer | points per line",
        q.answers.map((a) => `${a.text} | ${a.points}`).join("\n"),
        `${target}-answers-${index}`,
        true,
      );
      if (!final) {
        const label = e("label", "Round multiplier", box),
          select = e("select", undefined, box);
        select.id = `show-multiplier-${index}`;
        label.htmlFor = select.id;
        for (const n of [1, 2, 3]) {
          const o = e("option", `×${n}`, select);
          o.value = String(n);
        }
        select.value = String(q.multiplier ?? 1);
        const remove = e("button", "Remove this board", box);
        remove.type = "button";
        remove.disabled = questions.length <= 1;
        remove.onclick = () =>
          attempt(() => {
            read();
            show.rounds.splice(index, 1);
            render();
            say("Board removed. Save your show when ready.");
          });
      }
    });
  }
  $("add-board").disabled = show.rounds.length >= 8;
}
function read() {
  const parsed = { title: $("show-title").value, rounds: [], final: [] };
  for (const [target, list, final] of [
    ["show-rounds", parsed.rounds, false],
    ["show-final", parsed.final, true],
  ]) {
    const count = final ? 5 : show.rounds.length;
    for (let i = 0; i < count; i++) {
      const answers = $(`${target}-answers-${i}`)
        .value.split("\n")
        .filter((x) => x.trim())
        .map((line) => {
          const split = line.lastIndexOf("|");
          if (split < 1)
            throw new Error(
              "Each answer needs its points after |, such as: Sandwiches | 35",
            );
          return {
            text: line.slice(0, split).trim(),
            points: Number(line.slice(split + 1).trim()),
          };
        });
      list.push({
        question: $(`${target}-question-${i}`).value,
        answers,
        ...(!final
          ? { multiplier: Number($(`show-multiplier-${i}`).value) }
          : {}),
      });
    }
  }
  show = validateShow(parsed);
  return show;
}
function attempt(fn) {
  try {
    fn();
  } catch (error) {
    say(error.message || "Could not save this show.");
  }
}
function save() {
  const valid = read();
  localStorage.setItem(key, JSON.stringify(valid));
  say("Show saved on this device. Download a JSON backup to keep a copy.");
  return valid;
}
$("add-board").onclick = () =>
  attempt(() => {
    read();
    show.rounds.push({
      question: "Your next question",
      answers: [
        { text: "First answer", points: 60 },
        { text: "Second answer", points: 40 },
      ],
      multiplier: 1,
    });
    render();
  });
$("save-show").onclick = () => attempt(save);
$("host-show").onclick = () =>
  attempt(() => {
    const valid = save();
    sessionStorage.setItem("party-custom-show", JSON.stringify(valid));
    location.assign("./?game=feud");
  });
$("sample-show").onclick = () => {
  if (
    confirm(
      "Replace the current editor with the sample show? Save or export your edits first.",
    )
  ) {
    show = structuredClone(defaultShow);
    render();
    say("Sample loaded. Save when ready.");
  }
};
$("export-show").onclick = () =>
  attempt(() => {
    const content = JSON.stringify(
        { format: "trivia-lobby-show", version: 1, show: read() },
        null,
        2,
      ),
      url = URL.createObjectURL(
        new Blob([content], { type: "application/json" }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download = "trivia-lobby-show.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say("JSON backup downloaded.");
  });
$("import-show").onchange = async (event) => {
  try {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 32768)
      throw new Error("Use a show file smaller than 32 KB.");
    const imported = importShow(JSON.parse(await file.text()));
    show = imported;
    render();
    say("Show imported. Save on this device, then host when ready.");
  } catch (error) {
    say(error.message || "Could not import the show.");
  } finally {
    event.target.value = "";
  }
};
render();
say("Ready. Edit your boards and lightning questions, then Save & host.");
