import {createFeedbackToolkit, feedbackCues, feedbackLabels} from "./gx2-feedback.js";
const $ = id => document.getElementById(id);
const toolkit = createFeedbackToolkit({output: $("feedback")});
let round = 1, serial = 0;
function sync() {
  const state = toolkit.state();
  $("mute").checked = state.muted;
  $("volume").value = String(Math.round(state.volume * 100));
  $("volume-readout").value = String(Math.round(state.volume * 100)) + "%";
  $("low-power").checked = state.lowPower;
}
$("unlock").addEventListener("click", async () => {
  const enabled = await toolkit.unlock();
  $("status").textContent = enabled ? "Sound unlocked. Unmute to hear cues." : "Audio unavailable or blocked. Visual feedback still works.";
});
$("mute").addEventListener("change", event => { toolkit.setMuted(event.target.checked); sync(); });
$("volume").addEventListener("input", event => { toolkit.setVolume(Number(event.target.value) / 100); sync(); });
$("low-power").addEventListener("change", event => { toolkit.setLowPower(event.target.checked); sync(); });
$("next-round").addEventListener("click", () => {
  round++; serial = 0;
  toolkit.beginRound("demo-" + round);
  $("status").textContent = "Round " + round + ": prior events cancelled and deduplication reset.";
});
for (const cue of Object.keys(feedbackCues)) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = feedbackLabels[cue]; b.dataset.cue = cue;
  b.addEventListener("click", () => {
    const played = toolkit.play(cue, {eventId: "demo-" + round + "-" + (++serial), roundId: "demo-" + round});
    $("status").textContent = played.sounded ? "Played " + feedbackLabels[cue] : "Visual only: " + feedbackLabels[cue];
  });
  $("cue-grid").append(b);
}
toolkit.beginRound("demo-" + round);
sync();
window.addEventListener("pagehide", () => { void toolkit.dispose(); }, {once:true});
