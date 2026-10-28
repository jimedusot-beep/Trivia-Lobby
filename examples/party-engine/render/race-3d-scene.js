// SPDX-License-Identifier: AGPL-3.0-or-later
// Renderer initialization adapted from Super Kart 3DJS SceneManager.js (MIT),
// d94f63da26b6a01ecbfc1e301e5d754ea64649c2, Copyright 2026 Feco Linhares.
// Retained notice: open-pack/licenses/race-3d-reference.txt.
// All models, scenery, animation and authoritative-frame adaptation below are original.
import * as THREE from 'three';
import { TRACK, TRACK_POINTS, trackPose, ITEM_SPOTS, BOOST_SPOTS, RACE_COLORS } from '../public/race-track.js';
import { clamp, lerp, wrapAngle } from '../public/race-math.js';

const SCALE = 0.1;
export function createRaceScene({ onContextLost }) {
  const canvas = document.createElement('canvas');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  } catch (error) { canvas.remove(); throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setSize(TRACK.width, TRACK.height, false);
  canvas.dataset.renderer = '3d';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c5e6ec');
  const camera = new THREE.OrthographicCamera(-58, 58, 34.8, -34.8, 1, 300);
  camera.position.set(0, 110, 87); camera.lookAt(0, 0, -1);
  scene.add(new THREE.HemisphereLight('#fff1d7', '#617c75', 1.65));
  const sun = new THREE.DirectionalLight('#ffdfb0', 2.0);
  sun.position.set(-40, 90, 20); scene.add(sun);
  const director = new THREE.PerspectiveCamera(50, 5 / 3, 0.1, 300);
  const desiredPosition = new THREE.Vector3(), desiredLook = new THREE.Vector3(), lookAt = new THREE.Vector3();
  let cameraMode = 'overview', directorReady = false, focusNumber = null, focusUntil = 0;
  function setCamera(mode) { cameraMode = mode === 'director' ? 'director' : 'overview'; directorReady = false; }

  const geometries = new Map(), materials = new Map(), textures = new Set();
  const geometry = (key, factory) => {
    if (!geometries.has(key)) geometries.set(key, factory());
    return geometries.get(key);
  };
  const material = (color, options = {}) => {
    const key = JSON.stringify([color, options]);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.78, ...options }));
    return materials.get(key);
  };
  function mesh(g, m, parent = scene, x = 0, y = 0, z = 0) {
    const o = new THREE.Mesh(g, m); o.position.set(x, y, z); parent.add(o); return o;
  }
  function box(w, h, d, color, parent, x, y, z) {
    return mesh(geometry(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)), material(color), parent, x, y, z);
  }
  function ball(r, color, parent, x, y, z) {
    return mesh(geometry(`ball:${r}`, () => new THREE.SphereGeometry(r, 10, 7)), material(color), parent, x, y, z);
  }
  function textTexture(width, height, draw) {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    draw(c.getContext('2d'));
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture); return texture;
  }
  function label(number, parent, color) {
    const texture = textTexture(160, 96, c => {
      c.fillStyle = '#fff9ed'; c.beginPath(); c.roundRect(8, 8, 144, 80, 28); c.fill();
      c.strokeStyle = '#20304b'; c.lineWidth = 6; c.stroke();
      c.fillStyle = color; c.fillRect(26, 67, 108, 8);
      c.fillStyle = '#20304b'; c.font = '900 58px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(number), 80, 47);
    });
    const m = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
    materials.set(`label:${number}`, m);
    const sprite = new THREE.Sprite(m); sprite.position.set(0, 3.3, 0); sprite.scale.set(3, 1.8, 1); parent.add(sprite);
    return sprite;
  }

  // A single elevated island and inexpensive contact shadows replace GPU shadow maps.
  const water = mesh(geometry('water', () => new THREE.PlaneGeometry(220, 180)), material('#a8dfe4'));
  water.rotation.x = -Math.PI / 2; water.position.y = -2.2;
  const island = box(131, 1.8, 82, '#64af84', scene, 0, -0.7, 0);
  island.position.y = -1.1;
  box(129, 0.25, 80, '#61b97f', scene, 0, -0.08, 0);

  function ribbon(inner, outer, height, color, filter = () => true) {
    const vertices = [];
    const point = (i, offset) => {
      const p = TRACK_POINTS[i % TRACK.samples], pose = trackPose(i / TRACK.samples);
      return [(p.x - 600) * SCALE - Math.sin(pose.angle) * offset, height, (p.y - 360) * SCALE + Math.cos(pose.angle) * offset];
    };
    for (let i = 0; i < TRACK.samples; i++) if (filter(i)) {
      const a = point(i, inner), b = point(i, outer), c = point(i + 1, inner), d = point(i + 1, outer);
      vertices.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.computeVertexNormals();
    geometries.set(`ribbon:${geometries.size}`, g);
    return mesh(g, material(color, { side: THREE.DoubleSide }));
  }
  const road = TRACK.halfRoad * SCALE;
  ribbon(-road, road, 0.13, '#46536c');
  for (const side of [-1, 1]) {
    ribbon(side * road, side * (road + 0.65), 0.16, '#fff5d9', i => Math.floor(i / 3) % 2 === 0);
    ribbon(side * road, side * (road + 0.65), 0.16, '#f57575', i => Math.floor(i / 3) % 2 !== 0);
  }
  const dashGeometry = geometry('dash', () => new THREE.BoxGeometry(1.3, 0.03, 0.12));
  const dashes = new THREE.InstancedMesh(dashGeometry, material('#8c9eaf'), 80);
  const transform = new THREE.Object3D();
  for (let i = 0; i < 80; i++) {
    const p = trackPose(i / 80); transform.position.set((p.x - 600) * SCALE, 0.17, (p.y - 360) * SCALE);
    transform.rotation.y = -p.angle; transform.updateMatrix(); dashes.setMatrixAt(i, transform.matrix);
  }
  scene.add(dashes);

  for (const t of BOOST_SPOTS) {
    const p = trackPose(t), pad = new THREE.Group(); scene.add(pad);
    pad.position.set((p.x - 600) * SCALE, 0.19, (p.y - 360) * SCALE); pad.rotation.y = -p.angle;
    box(3.1, 0.08, road * 1.85, '#ffca60', pad, 0, 0, 0);
    for (const x of [-0.7, 0.5]) for (const side of [-1, 1]) {
      const arrow = box(1, 0.1, 0.28, '#fff4c5', pad, x, 0.08, side * 0.34); arrow.rotation.y = side * 0.65;
    }
  }
  const start = trackPose(0), arch = new THREE.Group(); scene.add(arch);
  arch.position.set((start.x - 600) * SCALE, 0.2, (start.y - 360) * SCALE); arch.rotation.y = -start.angle;
  for (const z of [-5.45, 5.45]) {
    box(0.65, 5.1, 0.65, '#fff6e1', arch, 0, 2.55, z);
    box(1, 0.55, 1, '#f57575', arch, 0, 0.3, z);
  }
  box(0.9, 1.1, 11.7, '#22314e', arch, 0, 5.25, 0);
  for (let i = 0; i < 12; i++) box(0.96, 0.55, 0.48, i % 2 ? '#fff6e1' : '#f7bd55', arch, 0, 5.25, -5.25 + i * 0.95);
  for (let x = 0; x < 4; x++) for (let z = 0; z < 12; z++)
    box(0.55, 0.02, 0.78, (x + z) % 2 ? '#fff8e9' : '#23314b', arch, x * 0.55 - 0.8, 0.02, z * 0.78 - 4.3);

  // Low-poly scenery stays outside the physical roadway.
  const trunkGeometry = geometry('trunk', () => new THREE.CylinderGeometry(0.18, 0.26, 2, 5));
  const crownGeometry = geometry('crown', () => new THREE.ConeGeometry(1.5, 3.8, 6));
  const trunks = new THREE.InstancedMesh(trunkGeometry, material('#ae8767'), 40);
  const crowns = new THREE.InstancedMesh(crownGeometry, material('#3e9273'), 40);
  for (let i = 0; i < 40; i++) {
    const p = trackPose((i + 0.3) / 40), offset = road + 4 + (i % 3) * 0.7;
    const x = (p.x - 600) * SCALE + Math.sin(p.angle) * offset;
    const z = (p.y - 360) * SCALE - Math.cos(p.angle) * offset;
    transform.position.set(x, 1, z); transform.rotation.set(0, i, 0); transform.scale.setScalar(0.8 + (i % 3) * 0.15); transform.updateMatrix(); trunks.setMatrixAt(i, transform.matrix);
    transform.position.y = 3; transform.updateMatrix(); crowns.setMatrixAt(i, transform.matrix);
  }
  transform.scale.setScalar(1); scene.add(trunks, crowns);
  for (const [x, z, color] of [[-49, -28, '#f8b96f'], [47, -29, '#8ab9b0'], [-51, 29, '#d7a37d']]) {
    const hill = mesh(geometry('hill', () => new THREE.ConeGeometry(7, 10, 6)), material(color), scene, x, 3, z); hill.rotation.y = 0.4;
  }
  for (const [x, z] of [[-20, -31], [18, 31]]) {
    const stand = new THREE.Group(); scene.add(stand); stand.position.set(x, 0.4, z);
    for (let row = 0; row < 3; row++) {
      box(16, 0.6 + row * 0.5, 1.6, '#fff0d5', stand, 0, row * 0.4, row * 1.5);
      for (let seat = 0; seat < 10; seat++) ball(0.32, ['#f57575', '#ffcb5d', '#7da7e8'][seat % 3], stand, seat * 1.4 - 6.3, 1 + row * 0.8, row * 1.5);
    }
  }
  const titleTexture = textTexture(1024, 256, c => {
    c.textAlign = 'center'; c.fillStyle = '#2a6457'; c.font = '800 36px sans-serif'; c.fillText('SUNSET SPEEDWAY', 512, 58);
    c.fillStyle = '#fff5d3'; c.font = '900 92px sans-serif'; c.fillText('PARTY GRAND PRIX', 514, 174);
    c.fillStyle = '#2a6457'; c.fillText('PARTY GRAND PRIX', 510, 169);
    c.font = '700 27px sans-serif'; c.fillText('YOUR PHONES. YOUR STARTING GRID.', 512, 224);
  });
  const titleMaterial = new THREE.MeshBasicMaterial({ map: titleTexture, transparent: true, depthWrite: false }); materials.set('title', titleMaterial);
  mesh(geometry('title', () => new THREE.PlaneGeometry(56, 14)), titleMaterial, scene, 0, 0.08, 0).rotation.x = -Math.PI / 2;

  const boxes = ITEM_SPOTS.map(t => {
    const p = trackPose(t), g = new THREE.Group(); scene.add(g); g.position.set((p.x - 600) * SCALE, 1.5, (p.y - 360) * SCALE);
    const cube = box(1.7, 1.7, 1.7, '#b09afa', g, 0, 0, 0); cube.rotation.z = 0.3;
    const tex = textTexture(64, 64, c => { c.fillStyle = '#fff9e8'; c.font = '900 58px sans-serif'; c.textAlign = 'center'; c.fillText('?', 32, 54); });
    const m = new THREE.SpriteMaterial({ map: tex }); materials.set(`box-label:${t}`, m);
    const s = new THREE.Sprite(m); s.scale.setScalar(1.2); s.position.y = 0.1; g.add(s); return g;
  });
  const hazards = Array.from({ length: 24 }, () => {
    const o = mesh(geometry('puddle', () => new THREE.CircleGeometry(2.3, 14)), material('#a580c5'), scene, 0, 0.18, 0);
    o.rotation.x = -Math.PI / 2; o.scale.y = 0.65; o.visible = false; return o;
  });
  const karts = new Map();
  function kart(number) {
    if (karts.has(number)) return karts.get(number);
    if (karts.size >= 20) return null;
    const color = RACE_COLORS[(number - 1) % RACE_COLORS.length];
    const root = new THREE.Group(), body = new THREE.Group(); scene.add(root); root.add(body);
    const shadow = mesh(geometry('shadow', () => new THREE.CircleGeometry(1.6, 12)), material('#23314b', { transparent: true, opacity: 0.18, depthWrite: false }), root, 0, 0.16, 0);
    shadow.rotation.x = -Math.PI / 2; shadow.scale.y = 0.68;
    box(2.7, 0.45, 1.55, color, body, 0, 0.65, 0);
    box(0.9, 0.35, 1.35, color, body, 1.05, 0.78, 0);
    box(0.22, 0.3, 2, '#fff6df', body, 1.5, 0.42, 0);
    box(0.6, 0.7, 1, '#24334d', body, -0.25, 1.05, 0);
    box(0.55, 0.18, 2.05, color, body, -1.35, 1.2, 0);
    const wheels = [];
    for (const x of [-0.9, 0.9]) for (const z of [-0.88, 0.88]) {
      const w = mesh(geometry('wheel', () => new THREE.CylinderGeometry(0.43, 0.43, 0.34, 10)), material('#263344'), root, x, 0.44, z);
      w.rotation.x = Math.PI / 2; wheels.push(w);
    }
    const helmet = ball(0.53, color, body, -0.12, 1.72, 0);
    const visor = box(0.32, 0.25, 0.83, '#2c4660', body, 0.29, 1.75, 0);
    const shield = mesh(geometry('shield', () => new THREE.SphereGeometry(1.75, 12, 8)), material('#8cddf2', { transparent: true, opacity: 0.3, depthWrite: false }), root, 0, 1.25, 0);
    const flame = mesh(geometry('flame', () => new THREE.ConeGeometry(0.5, 1.8, 7)), material('#ffd46a', { emissive: '#ff8d36', emissiveIntensity: 1 }), root, -2.1, 0.7, 0); flame.rotation.z = Math.PI / 2;
    const sparks = [-1, 1].map(side => ball(0.22, '#55c7ff', root, -1.2, 0.4, side * 1));
    const numberLabel = label(number, root, color);
    const model = { root, body, wheels, helmet, visor, shield, flame, sparks, numberLabel };
    karts.set(number, model); return model;
  }

  let disposed = false, lastPaint = -Infinity, lastWidth = TRACK.width, paintedFrames = 0;
  const lost = event => { event.preventDefault(); onContextLost(); };
  canvas.addEventListener('webglcontextlost', lost);
  function render(frame, previous, interpolation, now, reducedMotion) {
    if (disposed || document.hidden || now - lastPaint < 1000 / 30) return;
    const elapsed = Math.min(0.1, (now - lastPaint) / 1000); lastPaint = now;
    const width = Math.min(1440, Math.max(320, canvas.clientWidth || TRACK.width));
    if (width !== lastWidth) { renderer.setSize(width, Math.round(width * 0.6), false); lastWidth = width; }
    const previousKarts = new Map((previous.karts || []).map(k => [k.number, k]));
    for (const k of frame.karts || []) {
      const model = kart(k.number); if (!model) continue;
      const before = previousKarts.get(k.number), t = interpolation;
      const x = before ? lerp(before.x, k.x, t) : k.x, y = before ? lerp(before.y, k.y, t) : k.y;
      const angle = before ? before.angle + wrapAngle(k.angle - before.angle) * t : k.angle;
      model.root.position.set((x - 600) * SCALE, 0, (y - 360) * SCALE); model.root.rotation.y = -angle;
      const motion = before ? Math.hypot(k.x - before.x, k.y - before.y) : 0;
      model.body.position.y = reducedMotion || k.finished ? 0 : Math.sin(now / 80 + k.number) * 0.035;
      model.body.rotation.x = reducedMotion || !k.drift ? 0 : Math.sin(now / 170) * 0.055;
      model.helmet.rotation.z = reducedMotion ? 0 : Math.sin(now / 350 + k.number) * 0.05;
      for (const wheel of model.wheels) if (!reducedMotion) wheel.rotateY(-Math.min(8, motion) * elapsed * 2);
      model.shield.visible = !!k.shield; model.flame.visible = !!k.boost;
      model.flame.scale.y = reducedMotion ? 1 : 1 + Math.sin(now / 45) * 0.18;
      for (const spark of model.sparks) {
        spark.visible = k.drift > 0;
        spark.material = material(['#55c7ff', '#55c7ff', '#ffc65b', '#ce9bff'][k.drift] || '#55c7ff');
      }
    }
    boxes.forEach((b, i) => { b.visible = !!frame.boxes?.[i]; if (!reducedMotion) { b.rotation.y = now / 700; b.position.y = 1.5 + Math.sin(now / 300 + i) * 0.16; } });
    hazards.forEach((h, i) => { const v = frame.hazards?.[i]; h.visible = !!v; if (v) h.position.set((v.x - 600) * SCALE, 0.18, (v.y - 360) * SCALE); });
    let view = camera;
    if (cameraMode === 'director' && !reducedMotion && frame.karts?.length) {
      if (!focusNumber || now > focusUntil || !frame.karts.some(k => k.number === focusNumber && !k.finished)) {
        focusNumber = [...frame.karts].sort((a, b) => Number(a.finished) - Number(b.finished) || a.rank - b.rank)[0].number;
        focusUntil = now + 6000;
      }
      const focus = karts.get(focusNumber)?.root;
      if (focus) {
        const angle = -focus.rotation.y;
        desiredPosition.set(focus.position.x - Math.cos(angle) * 10, 6.3, focus.position.z - Math.sin(angle) * 10);
        desiredLook.set(focus.position.x + Math.cos(angle) * 5, 0.8, focus.position.z + Math.sin(angle) * 5);
        if (!directorReady) { director.position.copy(desiredPosition); lookAt.copy(desiredLook); directorReady = true; }
        else { director.position.lerp(desiredPosition, 0.12); lookAt.lerp(desiredLook, 0.12); }
        director.lookAt(lookAt); view = director;
      }
    }
    for (const [number, model] of karts) {
      model.numberLabel.visible = view !== director || number !== focusNumber;
      model.numberLabel.scale.set(view === director ? 1.2 : 3, view === director ? 0.72 : 1.8, 1);
    }
    renderer.render(scene, view);
    canvas.dataset.camera = view === director ? 'director' : 'overview';
    canvas.dataset.focusNumber = String(focusNumber || '');
    canvas.dataset.karts = String(karts.size);
    canvas.dataset.drawCalls = String(renderer.info.render.calls);
    canvas.dataset.renderFrame = String(++paintedFrames);
  }
  function dispose() {
    if (disposed) return; disposed = true;
    canvas.removeEventListener('webglcontextlost', lost);
    for (const g of geometries.values()) g.dispose();
    for (const m of materials.values()) m.dispose();
    for (const texture of textures) texture.dispose();
    scene.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
    scene.clear(); karts.clear(); renderer.dispose(); renderer.forceContextLoss();
  }
  return { canvas, render, dispose, setCamera };
}
