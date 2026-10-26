import { openPartyLabGames, openPartyLabBaseline } from "./open-party-lab-games.js";

const search = document.getElementById("opl-search");
const genre = document.getElementById("opl-genre");
const tenPlus = document.getElementById("opl-ten-plus");
const grid = document.getElementById("opl-games");
const count = document.getElementById("opl-count");
const hostForm = document.getElementById("opl-connect");
const hostAddress = document.getElementById("opl-host-address");
const hostFeedback = document.getElementById("opl-host-feedback");

const genres = [...new Set(openPartyLabGames.map((game) => game.genre))].sort();
for (const value of genres) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  genre.append(option);
}

const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function drawCatalog() {
  const term = search.value.trim().toLocaleLowerCase();
  const matched = openPartyLabGames
    .filter((game) =>
      (genre.value === "all" || game.genre === genre.value) &&
      (!tenPlus.checked || game.max >= 10) &&
      (!term || [game.name, game.genre, game.description, game.controller]
        .some((s) => s.toLocaleLowerCase().includes(term))))
    .sort((a, b) => b.max - a.max || a.name.localeCompare(b.name));

  grid.replaceChildren();
  for (const game of matched) {
    const card = make("article", "opl-game");
    const top = make("div", "opl-game-top");
    const label = make("span", "opl-tag", game.genre);
    const limit = make("span", "opl-limit", `${game.min}–${game.max} upstream players`);
    top.append(label, limit);
    card.append(top, make("h3", "", game.name));
    card.append(make("p", "opl-description", game.description));
    card.append(make("p", "opl-controls", `Phone: ${game.controller}`));
    const source = make("a", "opl-source", "View source & game details");
    source.href = game.repository;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    card.append(source);
    grid.append(card);
  }
  count.textContent = `${matched.length} of ${openPartyLabGames.length} upstream games. Reference catalog; games must be played through Open Party Lab itself.`;
}

function isLanHost(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)?.slice(1).map(Number);
    if (ipv4 && ipv4.some((n) => n > 255)) return null;
    const lan = host === "localhost" || host === "::1" || host.endsWith(".local") ||
      (ipv4 && (ipv4[0] === 10 || ipv4[0] === 127 || 
        (ipv4[0] === 192 && ipv4[1] === 168) ||
        (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31)));
    if (!lan || url.search || url.hash || url.pathname !== "/") return null;
    return url.origin + "/";
  } catch {
    return null;
  }
}

hostForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const address = isLanHost(hostAddress.value.trim());
  if (!address) {
    hostFeedback.textContent = "Enter a local http(s) address shown by your own launcher, such as http://192.168.1.20:3000. Public and credential-bearing URLs are not accepted.";
    return;
  }
  // Explicit user interaction only; never automatically scan LANs or request private hosts.
  window.location.assign(address);
});

search.addEventListener("input", drawCatalog);
genre.addEventListener("change", drawCatalog);
tenPlus.addEventListener("change", drawCatalog);
drawCatalog();
document.documentElement.dataset.catalogSourceRevision = openPartyLabBaseline.revision;
