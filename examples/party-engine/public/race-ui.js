// SPDX-License-Identifier: AGPL-3.0-or-later
// Original shared-screen/phone interface; the phone never simulates a race.
import { TRACK, TRACK_POINTS, trackPose, ITEM_SPOTS, BOOST_SPOTS, RACE_COLORS, ITEM_LABELS } from "./race-track.js";
import { createTiltSteering } from "./race-tilt.js";
import { clamp, lerp, wrapAngle } from "./race-math.js";
let active;
const node = (tag, text, parent, className) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (className) n.className = className;
  parent.append(n);
  return n;
};
const color = number => RACE_COLORS[(number - 1) % RACE_COLORS.length];

export function disposeRace() {
  active?.cleanup();
  active = null;
  document.body.classList.remove("race-host-active", "race-controller-active");
}
export function releaseRaceControls() { active?.release?.(); }
export function receiveRaceFrame(frame) {
  if (!active || frame.matchId !== active.state.matchId || frame.heat !== active.state.index) return;
  active.frame(frame);
}
export function updateRaceState(state) {
  if (!active || state.phase !== "playing" || state.pack?.kind !== "race" || active.key !== `${state.matchId}:${state.index}`) return false;
  active.state = state;
  active.frame(state.pack);
  return true;
}

export function renderRace(state, api) {
  if (state.phase !== "playing") {
    disposeRace();
    const root = node("section", undefined, document.getElementById("content"), "race-results");
    node("span", "THE CHECKERED FLAG", root, "eyebrow");
    node("h2", state.phase === "finished" ? "Grand Prix complete!" : `Heat ${state.index + 1} results`, root);
    node("p", "Championship points carry into the next heat. Everyone stays in the race.", root);
    const list = node("ol", undefined, root, "race-result-list");
    for (const result of state.pack.results || []) {
      const row = node("li", undefined, list);
      const badge = node("strong", `#${result.number}`, row, "race-number-small");
      badge.style.setProperty("--kart-color", color(result.number));
      node("span", `${result.place}. ${result.name}`, row);
      node("strong", `+${result.points}`, row);
      node("small", result.finished ? `${result.seconds}s` : "At the time limit", row);
    }
    return;
  }
  disposeRace();
  const root = node("section", undefined, document.getElementById("content"), "race-game");
  const host = state.role === "host";
  document.body.classList.add(host ? "race-host-active" : "race-controller-active");
  const a = active = { key: `${state.matchId}:${state.index}`, state, cleanup() {}, frame() {} };
  const titlebar = node("div", undefined, root, "race-titlebar");
  const title = node("div", undefined, titlebar);
  node("span", host ? "YOUR PHONES. YOUR STARTING GRID." : "PHONE CONTROLLER", title, "eyebrow");
  node("h2", "Party Grand Prix", title);
  node("span", `HEAT ${state.index + 1} / ${state.pack.totalHeats}`, titlebar, "race-heat");
  if (host) mountTV(a, root);
  else mountController(a, root, api);
  a.frame(state.pack);
}

function pathTrack(ctx) {
  ctx.beginPath();
  TRACK_POINTS.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath();
}
function staticTrack() {
  const canvas = document.createElement("canvas");
  canvas.width = TRACK.width; canvas.height = TRACK.height;
  const c = canvas.getContext("2d");
  c.fillStyle = "#94d5a0"; c.fillRect(0, 0, TRACK.width, TRACK.height);
  // Original paper-like grass, gardens, grandstands and infield lettering.
  c.fillStyle = "#82c591";
  for (let y = 12; y < 720; y += 22) for (let x = 12; x < 1200; x += 24) {
    c.beginPath(); c.arc(x + (y % 3) * 3, y, 1.5, 0, Math.PI * 2); c.fill();
  }
  c.lineJoin = c.lineCap = "round";
  pathTrack(c); c.lineWidth = TRACK.halfRoad * 2 + 22; c.strokeStyle = "#314057"; c.stroke();
  pathTrack(c); c.lineWidth = TRACK.halfRoad * 2 + 14; c.strokeStyle = "#fff8e7"; c.stroke();
  c.setLineDash([17, 17]); pathTrack(c); c.strokeStyle = "#f86e70"; c.stroke(); c.setLineDash([]);
  pathTrack(c); c.lineWidth = TRACK.halfRoad * 2; c.strokeStyle = "#465268"; c.stroke();
  c.setLineDash([16, 19]); pathTrack(c); c.lineWidth = 2; c.strokeStyle = "#788397"; c.stroke(); c.setLineDash([]);
  for (const t of BOOST_SPOTS) {
    const p = trackPose(t); c.save(); c.translate(p.x, p.y); c.rotate(p.angle);
    c.fillStyle = "#ffd35c"; c.fillRect(-18, -36, 36, 72);
    c.strokeStyle = "#fff6c3"; c.lineWidth = 5;
    for (const x of [-10, 3]) { c.beginPath(); c.moveTo(x, -22); c.lineTo(x + 9, 0); c.lineTo(x, 22); c.stroke(); }
    c.restore();
  }
  const start = trackPose(0); c.save(); c.translate(start.x, start.y); c.rotate(start.angle);
  for (let x = -2; x < 2; x++) for (let y = -4; y < 4; y++) {
    c.fillStyle = (x + y) % 2 ? "#fff9ed" : "#172538"; c.fillRect(x * 10, y * 11, 10, 11);
  }
  c.restore();
  c.textAlign = "center";
  c.fillStyle = "#254c45"; c.font = "700 20px Fredoka, sans-serif"; c.fillText("SUNSET SPEEDWAY", 600, 282);
  c.fillStyle = "#fff7d9"; c.font = "700 64px Fredoka, sans-serif"; c.fillText("PARTY", 602, 351);
  c.fillStyle = "#254c45"; c.fillText("PARTY", 600, 346);
  c.fillStyle = "#254c45"; c.font = "700 49px Fredoka, sans-serif"; c.fillText("GRAND PRIX", 600, 404);
  c.font = "600 18px Nunito, sans-serif"; c.fillText("ONE SCREEN · EVERYONE DRIVES", 600, 444);
  for (const [x, y] of [[155, 90], [1030, 85], [140, 635], [1050, 632]]) {
    for (let i = 0; i < 5; i++) {
      c.fillStyle = ["#fcce57", "#f98588", "#5a9dd9"][i % 3]; c.fillRect(x + i * 14, y, 10, 12);
      c.fillStyle = "#eff5e5"; c.fillRect(x + i * 14, y + 15, 10, 5);
    }
  }
  for (const [x, y] of [[70, 150], [58, 580], [1138, 170], [1140, 560], [380, 68], [830, 650]]) {
    c.fillStyle = "#5a956a"; c.beginPath(); c.arc(x + 3, y + 5, 18, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#31795a"; c.beginPath(); c.arc(x, y, 17, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#64a775"; c.beginPath(); c.arc(x - 5, y - 4, 9, 0, Math.PI * 2); c.fill();
  }
  return canvas;
}
function drawKart(c, k, before, t) {
  const x = before ? lerp(before.x, k.x, t) : k.x, y = before ? lerp(before.y, k.y, t) : k.y;
  const angle = before ? before.angle + wrapAngle(k.angle - before.angle) * t : k.angle;
  c.save(); c.translate(x, y); c.rotate(angle);
  if (k.boost) {
    c.fillStyle = "#ffbf49"; c.beginPath(); c.moveTo(-13, -5); c.lineTo(-28 - Math.sin(performance.now() / 45) * 6, 0); c.lineTo(-13, 5); c.fill();
  }
  if (k.shield) { c.strokeStyle = "#a9f4ff"; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 22, 0, Math.PI * 2); c.stroke(); }
  if (k.drift) {
    c.fillStyle = ["", "#57c9ff", "#ffc454", "#ce94ff"][k.drift];
    for (const y of [-10, 10]) { c.beginPath(); c.arc(-16, y, 3.5, 0, Math.PI * 2); c.fill(); }
  }
  c.fillStyle = "#263245"; c.fillRect(-10, -13, 9, 5); c.fillRect(-10, 8, 9, 5); c.fillRect(5, -12, 7, 4); c.fillRect(5, 8, 7, 4);
  c.fillStyle = "#17263855"; c.beginPath(); c.ellipse(2, 3, 16, 10, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = color(k.number); c.strokeStyle = "#fff7e8"; c.lineWidth = 1.8;
  c.beginPath(); c.roundRect(-13, -8, 27, 16, 5); c.fill(); c.stroke();
  c.fillStyle = "#ecf4fa"; c.fillRect(4, -5, 6, 10);
  c.fillStyle = "#24324b"; c.beginPath(); c.arc(-2, 0, 5, 0, Math.PI * 2); c.fill();
  c.restore();
  c.fillStyle = "#18263d"; c.strokeStyle = "#fff9ec"; c.lineWidth = 3.8;
  c.font = "800 14px Nunito, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
  c.strokeText(String(k.number), x, y - 22); c.fillText(String(k.number), x, y - 22);
}
function mountTV(a, root) {
  const caption = node("p", "Look for your number. Hold drift in a corner, then release for a boost.", root, "race-caption");
  const screen = node("div", undefined, root, "race-screen");
  const canvas = node("canvas", undefined, screen);
  canvas.id = "race-track"; canvas.width = TRACK.width; canvas.height = TRACK.height;
  canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", "Live overhead race track. Player numbers and positions are listed below.");
  const clock = node("span", "60s", screen, "race-clock"); clock.id = "race-clock";
  const legend = node("ol", undefined, root, "race-grid"); legend.setAttribute("aria-label", "Live racing positions");
  const rows = new Map();
  for (const driver of a.state.pack.roster) {
    const row = node("li", undefined, legend, "race-driver"); row.dataset.raceNumber = String(driver.number);
    const badge = node("strong", `#${driver.number}`, row, "race-number-small"); badge.style.setProperty("--kart-color", color(driver.number));
    node("span", driver.name, row, "race-driver-name");
    const position = node("span", "Ready", row, "race-place"); rows.set(driver.number, { row, position });
  }
  const viewControls = node("div", undefined, root, "race-view-controls");
  const viewButton = node("button", "Use 2D view", viewControls, "race-view-toggle");
  viewButton.type = "button";
  const viewStatus = node("span", "Loading 3D broadcast view…", viewControls, "race-view-status");
  viewStatus.setAttribute("role", "status");
  const cameraLabel = node("label", "Race camera ", viewControls, "race-camera-label");
  const cameraSelect = node("select", undefined, cameraLabel); cameraSelect.disabled = true;
  cameraSelect.setAttribute("aria-label", "Race camera");
  for (const [value, name] of [["overview", "Whole track"], ["director", "Race director"]]) {
    const option = node("option", name, cameraSelect); option.value = value;
  }
  try { cameraSelect.value = sessionStorage.getItem("party-race-camera") || "overview"; } catch {}
  const minimap = node("canvas", undefined, screen, "race-minimap");
  minimap.width = 240; minimap.height = 144; minimap.hidden = true;
  minimap.setAttribute("role", "img"); minimap.setAttribute("aria-label", "All racers on the full track. Numbered standings are below.");
  const directorBadge = node("span", undefined, screen, "race-director-badge"); directorBadge.hidden = true;
  const mapContext = minimap.getContext("2d");
  const c = canvas.getContext("2d"), background = staticTrack();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let scene3d = null, disposed = false, request = 0, prefer3d = true;
  try { prefer3d = sessionStorage.getItem("party-race-view") !== "2d"; } catch {}
  function saveView() { try { sessionStorage.setItem("party-race-view", prefer3d ? "3d" : "2d"); } catch {} }
  function fallback(message = "2D broadcast view") {
    viewButton.disabled = false; cameraSelect.disabled = true; minimap.hidden = true; directorBadge.hidden = true;
    if (scene3d) { scene3d.canvas.replaceWith(canvas); scene3d.dispose(); scene3d = null; }
    canvas.dataset.renderer = "2d";
    viewButton.textContent = "Use 3D view"; viewStatus.textContent = message;
  }
  async function start3d() {
    const token = ++request;
    viewButton.disabled = true;
    viewStatus.textContent = "Loading 3D broadcast view…";
    try {
      const { createRaceScene } = await import("./race-3d.bundle.js");
      if (disposed || token !== request || !prefer3d) return;
      const created = createRaceScene({ onContextLost() {
        if (disposed) return;
        ++request; prefer3d = false;
        fallback("3D graphics interrupted. Racing continues in 2D.");
      } });
      if (disposed || token !== request) { created.dispose(); return; }
      scene3d = created; created.setCamera(cameraSelect.value); cameraSelect.disabled = reducedMotion.matches;
      created.canvas.id = "race-track";
      created.canvas.setAttribute("role", "img");
      created.canvas.setAttribute("aria-label", "Live 3D overhead race track. Player numbers and positions are listed below.");
      // The fallback canvas remains available; a graphics failure never reloads a room.
      created.render(frame, previous, 1, performance.now(), reducedMotion.matches);
      canvas.replaceWith(created.canvas);
      viewButton.textContent = "Use 2D view"; viewStatus.textContent = "3D broadcast · all racers on one screen";
    } catch {
      prefer3d = false;
      fallback("3D is unavailable on this display. Racing continues in 2D.");
    } finally { if (!disposed && token === request) viewButton.disabled = false; }
  }
  cameraSelect.addEventListener("change", () => {
    scene3d?.setCamera(cameraSelect.value);
    try { sessionStorage.setItem("party-race-camera", cameraSelect.value); } catch {}
  });
  viewButton.addEventListener("click", () => {
    prefer3d = !scene3d; ++request; saveView();
    if (prefer3d) void start3d(); else fallback();
  });
  let frame = a.state.pack, previous = frame, receivedAt = performance.now(), animation;
  const draw = () => {
    if (active !== a) return;
    if (document.hidden) { animation = requestAnimationFrame(draw); return; }
    const interpolation = clamp((performance.now() - receivedAt) / 100, 0, 1);
    if (scene3d) {
      try {
        scene3d.render(frame, previous, interpolation, performance.now(), reducedMotion.matches);
        cameraSelect.disabled = reducedMotion.matches;
        minimap.hidden = scene3d.canvas.dataset.camera !== "director";
        directorBadge.hidden = minimap.hidden;
        directorBadge.textContent = "Race director · #" + scene3d.canvas.dataset.focusNumber;
        if (!minimap.hidden) {
          mapContext.drawImage(background, 0, 0, 240, 144);
          mapContext.font = "900 12px sans-serif"; mapContext.textAlign = "center";
          for (const k of frame.karts || []) {
            const x = k.x / 5, y = k.y / 5;
            mapContext.fillStyle = color(k.number); mapContext.beginPath(); mapContext.arc(x, y, 4, 0, Math.PI * 2); mapContext.fill();
            mapContext.lineWidth = 3; mapContext.strokeStyle = "#24324b"; mapContext.fillStyle = "#fff9e9";
            mapContext.strokeText(String(k.number), x, y - 6); mapContext.fillText(String(k.number), x, y - 6);
          }
        }
      }
      catch { prefer3d = false; fallback("3D graphics interrupted. Racing continues in 2D."); }
      animation = requestAnimationFrame(draw); return;
    }
    c.drawImage(background, 0, 0);
    const t = clamp((performance.now() - receivedAt) / 100, 0, 1);
    for (let i = 0; i < ITEM_SPOTS.length; i++) if (frame.boxes?.[i]) {
      const p = trackPose(ITEM_SPOTS[i]); c.save(); c.translate(p.x, p.y); c.rotate(Math.PI / 4);
      c.fillStyle = "#b99bff"; c.strokeStyle = "#fff7e7"; c.lineWidth = 3; c.fillRect(-12, -12, 24, 24); c.strokeRect(-12, -12, 24, 24); c.restore();
      c.font = "800 18px Nunito, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#fff"; c.fillText("?", p.x, p.y);
    }
    for (const h of frame.hazards || []) { c.fillStyle = "#b08cda"; c.beginPath(); c.ellipse(h.x, h.y, 23, 15, 0.2, 0, Math.PI * 2); c.fill(); }
    for (const k of frame.karts || []) drawKart(c, k, previous.karts?.find(p => p.number === k.number), t);
    animation = requestAnimationFrame(draw);
  };
  a.frame = next => {
    if (!next.karts || (frame.frame !== undefined && next.frame < frame.frame)) return;
    previous = frame; frame = next; receivedAt = performance.now();
    clock.textContent = `${next.remaining}s`;
    for (const k of next.karts) {
      const row = rows.get(k.number); if (!row) continue;
      row.row.dataset.rank = String(k.rank);
      row.position.textContent = k.finished ? `${k.rank} · Finished` : `${k.rank} · Lap ${k.lap}`;
    }
    caption.textContent = a.state.hostConnected ? "Look for your number. Hold drift in a corner, then release for a boost." : "Host reconnecting. The server keeps the race moving.";
  };
  animation = requestAnimationFrame(draw);
  a.cleanup = () => { disposed = true; ++request; cancelAnimationFrame(animation); scene3d?.dispose(); scene3d = null; };
  canvas.dataset.renderer = "2d";
  if (prefer3d) void start3d(); else fallback();
}

function mountController(a, root, api) {
  const own = a.state.pack.own;
  const driver = a.state.pack.roster.find(p => p.number === own?.number);
  const identity = node("div", undefined, root, "race-identity");
  const badge = node("strong", `#${own?.number}`, identity, "race-number"); badge.id = "race-own-number";
  badge.style.setProperty("--kart-color", color(own?.number || 1));
  const info = node("div", undefined, identity);
  node("h3", driver?.name || "Your kart", info);
  const place = node("p", "Finding your position…", info); place.id = "race-own-place";
  node("p", "Watch your number on the big screen.", root, "race-look-up");
  const itemText = node("p", "Pick up a purple box for an item.", root, "race-item-status"); itemText.id = "race-own-item";
  const charge = node("progress", undefined, root, "race-charge"); charge.max = 3.2; charge.value = 0; charge.setAttribute("aria-label", "Drift boost charge");
  const controls = node("div", undefined, root, "race-controls"); controls.setAttribute("role", "group"); controls.setAttribute("aria-label", "Racing controls");
  const tiltPanel = node("div", undefined, controls, "race-tilt-panel");
  const enableTilt = node("button", "Tilt steering", tiltPanel, "race-tilt-enable"); enableTilt.type = "button";
  enableTilt.title = "Hold the phone comfortably upright, then enable tilt to set the center.";
  const tiltStatus = node("span", "Centered", tiltPanel, "race-tilt-status"); tiltStatus.hidden = true;
  const centerTilt = node("button", "Center", tiltPanel); centerTilt.type = "button"; centerTilt.hidden = true;
  const touchMode = node("button", "Touch", tiltPanel); touchMode.type = "button"; touchMode.hidden = true;
  const left = node("button", "←", controls, "race-control race-left"); left.setAttribute("aria-label", "Steer left");
  const right = node("button", "→", controls, "race-control race-right"); right.setAttribute("aria-label", "Steer right");
  const drift = node("button", "HOLD\nDRIFT", controls, "race-control race-drift"); drift.setAttribute("aria-label", "Hold drift, release for boost");
  const item = node("button", "USE\nITEM", controls, "race-control race-item"); item.setAttribute("aria-label", "Use racing item");
  for (const b of [left, right, drift, item]) { b.type = "button"; b.setAttribute("aria-pressed", "false"); }
  const assistance = node("label", undefined, root, "race-assist");
  const assist = node("input", undefined, assistance); assist.type = "checkbox"; assist.checked = own?.assist ?? true;
  node("span", "Steering assistance", assistance);
  const hint = node("p", "Auto-accelerate is on. A / D to steer · Shift to drift · E for item.", root, "race-keyboard-hint");
  const connection = node("p", "Your phone is connected.", root, "race-controller-status"); connection.id = "race-controller-status";
  const held = new Map(), keys = new Map(), cleanups = [], timeouts = new Set();
  let seq = Math.max(0, (own?.seq ?? -1) + 1), finished = false, lastSent = -Infinity, itemPulse = false;
  const on = (target, type, fn, options) => { target.addEventListener(type, fn, options); cleanups.push(() => target.removeEventListener(type, fn, options)); };
  const tilt = createTiltSteering({onState({mode,message,value}) {
    const enabled=mode==='tilt';controls.dataset.steering=enabled?'tilt':'touch';
    enableTilt.hidden=enabled;enableTilt.disabled=mode==='pending';
    enableTilt.textContent=mode==='touch' && message!=='Touch steering' ? message+' · Retry' : mode==='pending'?message:'Tilt steering';
    tiltStatus.hidden=centerTilt.hidden=touchMode.hidden=!enabled;
    left.hidden=right.hidden=enabled;tiltStatus.textContent=message;
    tiltStatus.dataset.value=String(value);
  }});
  on(enableTilt,"click",()=>{release();void tilt.enable();});
  on(centerTilt,"click",()=>{release();});
  on(touchMode,"click",()=>{tilt.stop();release();});
  const isHeld = key => [...held.values()].includes(key) || [...keys.values()].includes(key);
  function send(force = false) {
    if (active !== a || finished || (document.hidden && !force)) return;
    const manual = Number(isHeld("right")) - Number(isHeld("left"));
    const input = { steer: manual || tilt.read(), drift: isHeld("drift"), item: isHeld("item") || itemPulse, assist: assist.checked };
    for (const [key, button] of [["left", left], ["right", right], ["drift", drift], ["item", item]]) button.setAttribute("aria-pressed", String(isHeld(key)));
    // Coalesce rapid touch transitions without exceeding the server input budget.
    // Keep a short item tap queued until a frame actually carries its rising edge.
    if (!force && performance.now() - lastSent < 30) return;
    lastSent = performance.now(); itemPulse = false;
    api.sendInput({ v: 1, type: "race_input", matchId: a.state.matchId, heat: a.state.index, seq: seq++, ...input });
  }
  function release() { held.clear(); keys.clear(); itemPulse = false; tilt.reset(); send(true); }
  a.release = release;
  for (const [key, button] of [["left", left], ["right", right], ["drift", drift], ["item", item]]) {
    on(button, "pointerdown", e => { e.preventDefault(); held.set(e.pointerId, key); if (key === "item") itemPulse = true; try { button.setPointerCapture(e.pointerId); } catch {} send(); });
    const up = e => { held.delete(e.pointerId); send(); };
    on(button, "pointerup", up); on(button, "pointercancel", up); on(button, "lostpointercapture", up);
    // Native keyboard/assistive activation creates a short, bounded press.
    on(button, "click", e => {
      if (e.detail !== 0) return;
      const id = `click-${key}`; held.set(id, key); if (key === "item") itemPulse = true; send();
      const timer = setTimeout(() => { timeouts.delete(timer); held.delete(id); send(); }, 180); timeouts.add(timer);
    });
  }
  const mapping = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ShiftLeft: "drift", ShiftRight: "drift", KeyE: "item" };
  on(window, "keydown", e => { const key = mapping[e.code]; if (!key || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; e.preventDefault(); if (!e.repeat) { keys.set(e.code, key); if (key === "item") itemPulse = true; send(); } });
  on(window, "keyup", e => { if (mapping[e.code]) { keys.delete(e.code); send(); } });
  on(window, "blur", () => { tilt.pause(); release(); }); on(window, "focus", () => tilt.resume()); on(window, "pagehide", release);
  on(document, "visibilitychange", () => { if (document.hidden) { tilt.pause(); release(); } else { tilt.resume(); send(); } });
  on(assist, "change", () => send());
  const interval = setInterval(send, 50);
  a.frame = next => {
    if (!next.own) return;
    const o = next.own;
    seq = Math.max(seq, o.seq + 1); finished = o.finished;
    place.textContent = `${o.rank} / ${a.state.pack.roster.length} · Lap ${o.lap} / ${a.state.pack.laps} · ${next.remaining}s`;
    place.dataset.rank = String(o.rank); place.dataset.speed = String(o.speed); place.dataset.assist = String(o.assisting);
    itemText.textContent = o.finished ? "You finished! Your place is locked." : o.item ? ITEM_LABELS[o.item] : "Pick up a purple box for an item.";
    item.dataset.available = String(!!o.item); item.disabled = o.finished;
    charge.value = o.charge; charge.dataset.stage = String(o.stage);
    connection.textContent = o.finished ? "Watch the remaining racers on the big screen." : o.boost ? "BOOST!" : o.shield ? "Bubble shield active." : o.assisting ? "Steering assistance is helping." : "You're driving. Hold drift in a corner.";
    for (const b of [left, right, drift]) b.disabled = o.finished;
    hint.hidden = matchMedia("(pointer: coarse)").matches;
  };
  a.cleanup = () => { tilt.dispose(); held.clear(); keys.clear(); clearInterval(interval); for (const fn of cleanups) fn(); for (const timer of timeouts) clearTimeout(timer); };
  send();
}
