import { qrcodegen } from "./vendor/qrcodegen.js";

const svgNamespace = "http://www.w3.org/2000/svg";

/** Public room URL only: discard host queries, local quiz IDs and fragments. */
export function guestInvitation(pageUrl, code) {
  const page = new URL(pageUrl);
  const invite = new URL("./", page.origin + page.pathname);
  invite.searchParams.set("code", code);
  return invite.href;
}

export function invitationGeometry(url) {
  try {
    const qr = qrcodegen.QrCode.encodeText(url, qrcodegen.QrCode.Ecc.MEDIUM);
    let path = "";
    for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) {
      if (qr.getModule(x, y)) path += `M${x + 4},${y + 4}h1v1h-1z`;
    }
    return { size: qr.size + 8, path };
  } catch { return null; }
}

export function invitationSvg(url, label) {
  const geometry = invitationGeometry(url);
  if (!geometry) return null;
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("xmlns", svgNamespace);
  svg.setAttribute("viewBox", `0 0 ${geometry.size} ${geometry.size}`);
  svg.setAttribute("width", "280"); svg.setAttribute("height", "280");
  svg.setAttribute("role", "img"); svg.setAttribute("aria-label", label);
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.classList.add("lobby-invite-qr");
  const title = document.createElementNS(svgNamespace, "title"); title.textContent = label;
  const paper = document.createElementNS(svgNamespace, "rect");
  paper.setAttribute("width", String(geometry.size)); paper.setAttribute("height", String(geometry.size)); paper.setAttribute("fill", "white");
  const ink = document.createElementNS(svgNamespace, "path"); ink.setAttribute("d", geometry.path); ink.setAttribute("fill", "#20264b");
  svg.append(title, paper, ink);
  return svg;
}

export async function copyInvitation(url) {
  try { await navigator.clipboard.writeText(url); return true; }
  catch { return false; }
}

export async function shareInvitation(url) {
  if (navigator.share) {
    try { await navigator.share({ title: "Join Trivia Lobby", text: "You're invited to play!", url }); return "shared"; }
    catch (error) { if (error?.name === "AbortError") return "cancelled"; }
  }
  return await copyInvitation(url) ? "copied" : "manual";
}

export function saveInvitationQr(url, label, filename) {
  const svg = invitationSvg(url, label);
  if (!svg) return false;
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  return true;
}

/** Shared accessible widget, used by both React hosts and the plain guest app. */
export function mountRoomInvitation(container, { url, code, assignment = false }) {
  const node = (tag, text, parent) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    parent.append(element); return element;
  };
  const card = node("section", "", container); card.className = "lobby-invite-card";
  card.setAttribute("aria-label", assignment ? "Assignment invitation" : "Party invitation");
  const visual = node("div", "", card); visual.className = "lobby-invite-visual";
  const label = assignment ? "Scan QR code to open this assignment" : `Scan QR code to join room ${code}`;
  const qr = invitationSvg(url, label);
  if (qr) visual.append(qr);
  else node("p", "QR code unavailable. Use the invitation link or room code instead.", visual);
  node("p", "Scan with your phone · No account required", visual);
  const content = node("div", "", card); content.className = "lobby-invite-content";
  node("span", "GOOD TIMES START HERE", content).className = "lobby-invite-kicker";
  node("h2", assignment ? "A quiz worth sharing." : "Scan. Join. Play.", content);
  if (code) { const room = node("p", "Room code: ", content); node("strong", code, room); }
  node("p", assignment ? "Open the invitation to start at your own pace." : "Choose a nickname and you're in. New players join in the lobby; returning players can reconnect.", content);
  const fieldLabel = node("label", assignment ? "Guest invitation link" : "Direct invitation link", content);
  const input = node("input", "", content);
  input.id = assignment ? "assignment-link" : "invite-link"; input.type = "text"; input.readOnly = true; input.value = url;
  fieldLabel.htmlFor = input.id; input.addEventListener("focus", () => input.select());
  const link = node("a", assignment ? "Open guest invitation" : "Open guest invitation in new tab", content);
  // A new, no-opener tab gets its own sessionStorage. Otherwise, opening an
  // invitation from a hosting phone can silently resume the host identity
  // rather than showing the guest nickname form.
  link.href = url; link.id = "invite";
  link.target = "_blank"; link.rel = "noopener noreferrer";
  const controls = node("div", "", content); controls.className = "lobby-invite-actions";
  const notice = node("p", "", content); notice.className = "lobby-invite-notice"; notice.setAttribute("role", "status");
  const manualCopy = () => { input.focus(); input.select(); notice.textContent = "Copy the selected invitation link, or scan the QR code."; };
  const control = (text, action) => {
    const button = node("button", text, controls); button.type = "button";
    button.addEventListener("click", action); return button;
  };
  control("Copy invitation link", async () => {
    if (await copyInvitation(url)) notice.textContent = "Invitation copied. Send it to your friends!";
    else manualCopy();
  });
  control("Share game", async () => {
    const result = await shareInvitation(url);
    if (result === "manual") manualCopy();
    else if (result === "copied") notice.textContent = "Invitation copied. Send it to your friends!";
    else if (result === "shared") notice.textContent = "Invitation shared.";
  });
  const save = control("Save QR image", () => {
    try {
      if (saveInvitationQr(url, label, `trivia-lobby-${assignment ? "assignment" : code}.svg`)) notice.textContent = "QR image saved. Share it or print it for your game night.";
      else notice.textContent = "QR image unavailable. Share the invitation link instead.";
    } catch { notice.textContent = "Image download unavailable. Share the invitation link instead."; }
  });
  save.disabled = !qr;
  return card;
}
