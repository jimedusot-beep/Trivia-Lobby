# Grand Prix static track batching — review and test plan

**Scope:** one renderer optimization, browser draw-call regression, and this handoff. No gameplay or live deployment changes.

## Why

PR #114 measured the existing **two-player** headless Ubuntu CI scene at **202 3D draw calls**. In the same runner the first 3D requestAnimationFrame gap p50 was 149.9 ms versus 16.7 ms in the 2D fallback, but rAF intervals are not GPU execution time and are not valid physical Windows FPS. This optimization targets the draw-call side only. It does **not** assert a frame-rate improvement.

## Change

- At scene initialization (once per instance), inspect **static, opaque mesh objects only**, after the original track/stands/arch/pennants have been constructed and **before** creating live item boxes, hazards, or karts.
- For meshes using the exact same geometry object and material object, replace their individual draw calls with a `THREE.InstancedMesh`. Copy full existing world matrices into each instance, preserving transform and appearance, and compute bounds for normal frustum culling.
- Leave singleton meshes, existing instanced props, transparent objects, animated pickups/hazards, karts, number labels, race physics and shared networking/controller state untouched.
- Reuse the renderer's existing `dispose()` cleanup for all instances; geometry/material caches still own those resources. No extra shaders, new files/assets, third-party imports, dependencies or server activity.

## Verifiable acceptance

- Existing two-player Chromium 3D browser spec now asserts **fewer than 160 draw calls**, compared with the earlier measured 202; threshold is a quality gate, **not a measured new result**.
- Full check/build; guest unit tests and real WebGL 3D/2D/browser tests on Chromium, Firefox and WebKit.
- Confirm start arch, checkered grid, grandstands, trees, festival decorations and track markers are still positioned correctly with before/after images at the same host/camera and racer state.
- Check 3D overview/director modes, real WebGL context loss, fallback to 2D, repeated scene teardown and no 3D bundle on phone controllers.
- Once PR #114's benchmark tooling is available, rerun it on this exact change in equivalent CI environment to compare draw calls and rAF distributions, plus Windows/HDMI for meaningful hardware observations.
- Manually test 2, 10 and 20 real/simulated racers with scene-frame times and readable numbers. Keep 2D mode when host GPU is inadequate.

**Not claimed:** any increase in FPS, any visual screenshot acceptance, physical phone/TV results or new live deployment. A regression must be fixed before merge. Rollback is one renderer/test PR revert.
