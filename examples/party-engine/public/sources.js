// SPDX-License-Identifier: AGPL-3.0-or-later
const e = (tag, text, parent) => {
  const n = document.createElement(tag);
  n.textContent = text;
  parent.append(n);
  return n;
};
try {
  const response = await fetch("./open-source/credits.json");
  if (!response.ok) throw new Error("unavailable");
  const credits = await response.json();
  document.getElementById("repository-source").href = credits.sourceUrl;
  const root = document.getElementById("source-list");
  for (const source of credits.sources) {
    const box = e("article", "", root);
    e("h2", source.repository.split("/").slice(-2).join("/"), box);
    e("p", source.reuse, box);
    e("p", `Reference revision: ${source.commit}`, box);
    const link = e("a", "Upstream source", box);
    link.href = `${source.repository}/tree/${source.commit}`;
    e("span", " · ", box);
    const license = e("a", `${source.license} notice`, box);
    license.href = `./open-source/${source.id}.txt`;
  }
  const box = e("article", "", root);
  e("h2", "chess.js 1.4.0", box);
  e(
    "p",
    "Legal chess moves, checks, castling, en passant, promotion and game termination.",
    box,
  );
  const license = e("a", "BSD-2-Clause notice", box);
  license.href = "./open-source/chess.txt";
  document.getElementById("source-status").textContent =
    "Credits and corresponding source are available below.";
} catch {
  document.getElementById("source-status").textContent =
    "Credits could not load. Complete source and recorded upstream revisions are available in the GitHub repository.";
}
