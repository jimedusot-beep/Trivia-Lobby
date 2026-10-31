import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { gzipSync } from "node:zlib";

// Actual compiled-file bytes, not browser network transfer timings.
async function collect(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) await collect(p, out);
    else if (ent.isFile()) out.push(p);
  }
  return out;
}
const assets = [];
for (const path of await collect("dist/public/assets")) {
  if (![".js", ".css"].includes(extname(path))) continue;
  const data = await readFile(path);
  assets.push({ path: relative("dist/public", path).replaceAll("\\", "/"), bytes: data.length, gzipBytes: gzipSync(data).length });
}
assets.sort((a, b) => b.bytes - a.bytes);
const optional = async path => {
  try {
    const data = await readFile(path);
    return { path, bytes: data.length, gzipBytes: gzipSync(data).length };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};
const sum = field => assets.reduce((total, item) => total + item[field], 0);
const report = {
  revision: process.env.GITHUB_SHA || "local",
  measuredAt: new Date().toISOString(),
  kind: "production-build-files-not-network-performance",
  assetCount: assets.length,
  totalAssetBytes: sum("bytes"),
  totalAssetGzipBytes: sum("gzipBytes"),
  rootCssBytes: assets.filter(x => x.path.endsWith(".css")).reduce((s, x) => s + x.bytes, 0),
  topTen: assets.slice(0, 10),
  guest3d: await optional("dist/party/race-3d.bundle.js"),
  assets
};
await mkdir("performance-results", { recursive: true });
await writeFile("performance-results/bundle-sizes.json", JSON.stringify(report, null, 2) + "\n");
console.log("MEASURED_BUNDLE=" + JSON.stringify({
  assetCount: report.assetCount, totalAssetBytes: report.totalAssetBytes,
  totalAssetGzipBytes: report.totalAssetGzipBytes, topFive: report.topTen.slice(0, 5), guest3d: report.guest3d
}));
