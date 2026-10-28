// Publish the precise guest source and notices used by this build. No environment,
// private content, database records or credentials are included.
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { buildRaceRenderer } from './build-race-renderer.mjs';
const root = fileURLToPath(new URL("../", import.meta.url));
export async function buildGameSources() {
  await buildRaceRenderer();
  const files = [];
  async function collect(relative) {
    for (const entry of await readdir(path.join(root, relative), {
      withFileTypes: true,
    })) {
      if (entry.name === 'race-3d.bundle.js') continue;
      if (
        [
          "node_modules",
          "test-results",
          "playwright-report",
          "open-source",
          ".git",
        ].includes(entry.name)
      )
        continue;
      const name = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) await collect(name);
      else if (
        entry.isFile() &&
        /\.(js|json|html|css|ts|mjs|txt|md)$/.test(entry.name)
      )
        files.push({
          path: name,
          content: await readFile(path.join(root, name), "utf8"),
        });
    }
  }
  await collect("examples/party-engine");
  for (const name of [
    "package.json",
    "package-lock.json",
    "script/build.ts",
    "script/build-game-sources.mjs",
    "script/build-race-renderer.mjs",
    "server/guest-party.ts",
    "docs/OPEN_GAME_PACK.md",
    "docs/OPEN_GAME_SOURCES.json",
  ])
    files.push({
      path: name,
      content: await readFile(path.join(root, name), "utf8"),
    });
  let commit;
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    commit = process.env.RENDER_GIT_COMMIT;
  }
  const valid = typeof commit === "string" && /^[a-f0-9]{40}$/.test(commit);
  const output = path.join(root, "examples/party-engine/public/open-source");
  await mkdir(output, { recursive: true });
  const provenance = JSON.parse(
    await readFile(path.join(root, "docs/OPEN_GAME_SOURCES.json"), "utf8"),
  );
  await writeFile(
    path.join(output, "source.json"),
    JSON.stringify(
      {
        format: "trivia-lobby-guest-source",
        license: "AGPL-3.0-or-later (with retained MIT/BSD component notices)",
        commit: valid ? commit : null,
        repository: "https://github.com/jimedusot-beep/Trivia-Lobby",
        build:
          "npm ci --include=dev && npm run build; standalone: cd examples/party-engine && npm ci && npm start",
        files,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(output, "credits.json"),
    JSON.stringify(
      {
        commit: valid ? commit : null,
        sourceUrl: `https://github.com/jimedusot-beep/Trivia-Lobby/tree/${valid ? commit : "main"}`,
        sources: provenance,
      },
      null,
      2,
    ),
  );
  for (const entry of await readdir(
    path.join(root, "examples/party-engine/open-pack/licenses"),
  )) {
    await writeFile(
      path.join(output, entry),
      await readFile(
        path.join(root, "examples/party-engine/open-pack/licenses", entry),
      ),
    );
  }
  let chessLicense;
  try {
    chessLicense = await readFile(
      path.join(root, "node_modules/chess.js/LICENSE"),
    );
  } catch {
    chessLicense = await readFile(
      path.join(root, "examples/party-engine/node_modules/chess.js/LICENSE"),
    );
  }
  await writeFile(path.join(output, "chess.txt"), chessLicense);
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  await buildGameSources();
