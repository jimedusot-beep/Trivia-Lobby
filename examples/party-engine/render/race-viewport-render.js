// SPDX-License-Identifier: AGPL-3.0-or-later
// Shared scissor/viewport pass for one Three.js renderer and one canvas.
// Pure enough to test with a fake renderer; imports nothing from Three.js.

function viewportArgs(rect) {
  return [
    Math.round(rect.gl.x),
    Math.round(rect.gl.y),
    Math.max(1, Math.round(rect.gl.width)),
    Math.max(1, Math.round(rect.gl.height)),
  ];
}

export function updateViewportCamera(camera, rect) {
  const aspect = rect.gl.width / rect.gl.height;
  if (camera && Number.isFinite(aspect) && camera.aspect !== aspect) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix?.();
  }
}

export function renderSplitViewports(renderer, scene, views, width, height) {
  renderer.setScissorTest(true);
  let calls = 0;
  for (let index = 0; index < views.length; index++) {
    const view = views[index];
    if (!view?.rect || !view.camera) continue;
    updateViewportCamera(view.camera, view.rect);
    const args = viewportArgs(view.rect);
    renderer.setViewport(...args);
    renderer.setScissor(...args);
    renderer.render(scene, view.camera);
    calls += renderer.info?.render?.calls || 0;
  }
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, width, height);
  renderer.setScissor(0, 0, width, height);
  return calls;
}
