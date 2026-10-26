// Original Tap Dash phone/TV display. Server alone validates taps and awards points.
let active = null;
const node = (tag, text, parent, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
};
export function disposeTap() {
  active = null;
  document.body.classList.remove("tap-host-active", "tap-controller-active");
}
export function receiveTapFrame(frame) {
  if (!active || frame.matchId !== active.state.matchId || frame.heat !== active.state.index) return;
  active.update(frame);
}
export function updateTapState(state) {
  if (!active || state.phase !== "playing" || state.pack?.kind !== "tap" ||
      active.key !== `${state.matchId}:${state.index}`) return false;
  active.state = state;
  active.update(state.pack);
  return true;
}
export function renderTap(state, { sendInput }) {
  disposeTap();
  const root = node("section", undefined, document.getElementById("content"), "tap-dash");
  const title = node("h2", state.phase === "playing" ? "👆 Tap Dash" : "🏆 Tap Dash results", root);
  title.className = "tap-title";
  node("p", `Heat ${state.index + 1} of ${state.pack.totalHeats}`, root, "tap-heat");
  if (state.phase !== "playing") {
    const list = node("ol", undefined, root, "tap-results");
    for (const result of state.pack.results || []) {
      const row = node("li", undefined, list);
      node("strong", `#${result.place} ${result.name}`, row);
      node("span", `${result.taps} taps · +${result.points} points`, row);
    }
    node("p", "Scores carry into the next heat. Players tied on taps share a place.", root);
    return;
  }
  const host = state.role === "host";
  document.body.classList.add(host ? "tap-host-active" : "tap-controller-active");
  const panel = node("div", undefined, root, "tap-panel");
  const timer = node("strong", "12.0s", panel, "tap-clock");
  const a = active = {
    key: `${state.matchId}:${state.index}`, state,
    update() {},
  };
  if (host) {
    node("p", "Everyone joins with the same QR code. Watch the live tap race!", panel, "tap-hint");
    const list = node("ol", undefined, panel, "tap-leaderboard");
    a.update = frame => {
      timer.textContent = `${(frame.remainingMs / 1000).toFixed(1)}s`;
      if (!frame.racers) return;
      list.replaceChildren();
      const top = Math.max(1, ...frame.racers.map(racer => racer.taps));
      for (const racer of frame.racers) {
        const row = node("li", undefined, list, "tap-racer");
        node("span", `#${racer.place} ${racer.name}${racer.connected ? "" : " · offline"}`, row);
        const bar = node("span", undefined, row, "tap-bar");
        bar.style.width = `${Math.round((racer.taps / top) * 100)}%`;
        bar.setAttribute("aria-hidden", "true");
        node("strong", String(racer.taps), row);
      }
    };
  } else {
    node("p", "Tap as quickly as you can! One finger or keyboard works.", panel, "tap-hint");
    const ownTaps = node("strong", "0", panel, "tap-count");
    const place = node("p", "Get ready…", panel, "tap-position");
    const tap = node("button", "TAP!", panel, "tap-button");
    tap.type = "button";
    tap.setAttribute("aria-label", "Tap to race");
    let seq = Math.max(0, (state.pack.own?.seq ?? -1) + 1);
    let lastSent = -Infinity;
    tap.addEventListener("click", () => {
      const now = performance.now();
      if (!active || active !== a || now - lastSent < 78) return;
      if (a.state.phase !== "playing") return;
      lastSent = now;
      sendInput({ v: 1, type: "tap_input", matchId: a.state.matchId, heat: a.state.index, seq: seq++ });
    });
    a.update = frame => {
      timer.textContent = `${(frame.remainingMs / 1000).toFixed(1)}s`;
      if (!frame.own) return;
      ownTaps.textContent = String(frame.own.taps);
      place.textContent = `Place #${frame.own.place}`;
      seq = Math.max(seq, frame.own.seq + 1);
    };
  }
  a.update(state.pack);
}
