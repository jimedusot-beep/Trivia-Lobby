import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { buildRaceRenderer } from '../../../script/build-race-renderer.mjs';

test('standalone 3D renderer builds locally within its transfer budget', async () => {
  await buildRaceRenderer();
  const bytes=await readFile(new URL('../public/race-3d.bundle.js',import.meta.url));
  assert(bytes.length < 650000, `3D bundle ${bytes.length} exceeds budget`);
  assert(gzipSync(bytes).length < 180000, 'compressed 3D bundle exceeds budget');
  assert.match(bytes.toString(),/Three.js MIT notice/);
});
