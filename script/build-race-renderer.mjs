import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function buildRaceRenderer() {
  // Root production builds and standalone guest builds install their own lockfile.
  let bundler;
  try { bundler = createRequire(path.join(root, 'package.json'))('esbuild'); }
  catch { bundler = createRequire(path.join(root, 'examples/party-engine/package.json'))('esbuild'); }
  await bundler.build({
    absWorkingDir: root,
    entryPoints: ['examples/party-engine/render/race-3d-scene.js'],
    outfile: 'examples/party-engine/public/race-3d.bundle.js',
    bundle: true, format: 'esm', platform: 'browser', target: 'es2020',
    minify: true, legalComments: 'inline',
    banner: { js: '// Three.js MIT notice: ./open-source/three.txt; renderer adaptation: ./open-source/race-3d-reference.txt' },
  });
}
