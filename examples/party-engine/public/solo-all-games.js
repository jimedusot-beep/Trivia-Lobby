// Run every existing party mode, unmodified, with the actual host + guest
// frontends in same-origin embedded views. Test seats are ordinary guests:
// no privileged backend bots, auth bypass or copied private player projections.
const $ = id => document.getElementById(id);
const partyUrl = new URL("./", location.href);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const roomPattern = /^[A-HJ-NP-Z2-9]{6}$/;

export function makeFullGameLab({ game, seats, isActive, report }) {
  let cancelled = false, code = "", views = [], selected = 0;
  const hostFrame = $("solo-all-host-frame");
  const guestFrameBox = $("solo-all-seat-frames");
  const roleSelect = $("solo-all-seat-switch");
  const status = text => { if (!cancelled && isActive()) report(text); };
  const guard = () => {
    if (cancelled || !isActive()) throw new Error("Solo test stopped.");
  };
  async function waitFor(check, label, timeout = 22000) {
    const deadline = performance.now() + timeout;
    while (performance.now() < deadline) {
      guard();
      try {
        const found = check();
        if (found) return found;
      } catch (error) {
        if (cancelled || !isActive()) throw error;
        // The frame may still be navigating to its initial same-origin URL.
      }
      await sleep(110);
    }
    throw new Error("Timed out: " + label + ". Check the test room connection.");
  }
  const embeddedUrl = seat => {
    const url = new URL(partyUrl.href);
    url.searchParams.set("solo-seat", seat);
    if (code) url.searchParams.set("code", code);
    return url.href;
  };
  const seatId = index => "solo-" + crypto.randomUUID().replaceAll("-", "").slice(0, 24) + "-" + index;
  function frameDocument(frame) {
    const doc = frame.contentDocument;
    if (!doc || doc.location?.origin !== location.origin) return null;
    return doc;
  }
  async function load(frame, url, label) {
    guard();
    frame.src = url;
    await waitFor(() => {
      const doc = frameDocument(frame);
      return doc?.readyState === "complete" && doc.querySelector("#join") && doc.querySelector("#create");
    }, label + " page");
  }
  function selectSeat(index) {
    selected = index;
    views.forEach((view, i) => { view.hidden = i !== index; });
    roleSelect.value = String(index);
    $("solo-all-seat-note").textContent =
      index === 0 ? "You're controlling Seat 1. Switch seats to play opponents' turns." :
        "You're controlling Test Seat " + (index + 1) + ". This is a real, separate guest session.";
  }
  roleSelect.addEventListener("change", () => {
    const index = Number(roleSelect.value);
    if (Number.isSafeInteger(index) && index >= 0 && index < views.length) selectSeat(index);
  });

  async function start() {
    guard();
    // Each iframe navigates to /party/?solo-seat=... and uses its own
    // transient WebSocket identity. All frames share the browser tab.
    const hostSeat = seatId("host");
    status("Opening the real host screen…");
    await load(hostFrame, embeddedUrl(hostSeat), "Host");
    guard();
    const hostDoc = frameDocument(hostFrame);
    hostDoc.getElementById("create").click();
    const modeField = await waitFor(() => frameDocument(hostFrame)?.querySelector("#mode"), "Host room");
    const heading = frameDocument(hostFrame)?.querySelector("#heading")?.textContent ?? "";
    code = heading.split("·")[0].trim();
    if (!roomPattern.test(code)) throw new Error("The host did not provide a valid test room code.");
    $("solo-all-room").textContent = "Temporary room " + code + " · " + game.name;
    for (let i = 0; i < seats; i++) {
      guard();
      status("Joining test seat " + (i + 1) + " of " + seats + "…");
      const frame = document.createElement("iframe");
      frame.id = "solo-all-seat-frame-" + i;
      frame.title = (i === 0 ? "Your" : "Test") + " controller, Seat " + (i + 1);
      frame.className = "solo-all-player-frame";
      frame.setAttribute("loading", "eager");
      frame.hidden = i !== 0;
      guestFrameBox.append(frame);
      views.push(frame);
      await load(frame, embeddedUrl(seatId(i)), "Guest " + (i + 1));
      const doc = frameDocument(frame);
      const codeField = doc.getElementById("code");
      const nameField = doc.getElementById("name");
      codeField.value = code;
      codeField.dispatchEvent(new Event("input", { bubbles: true }));
      nameField.value = i === 0 ? "You" : "Test Seat " + (i + 1);
      nameField.dispatchEvent(new Event("input", { bubbles: true }));
      doc.getElementById("join").requestSubmit();
      await waitFor(() => {
        const current = frameDocument(frame);
        return current && current.body.classList.contains("party-playing") &&
          current.querySelector("#game")?.hidden === false;
      }, "Guest " + (i + 1) + " admission");
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = i === 0 ? "Seat 1 · You" : "Seat " + (i + 1) + " · Test opponent";
      roleSelect.append(option);
    }
    selectSeat(0);
    guard();
    status("All " + seats + " guests joined. Starting " + game.name + "…");
    modeField.value = game.id;
    modeField.dispatchEvent(new Event("change", { bubbles: true }));
    const startButton = await waitFor(() => [...(frameDocument(hostFrame)?.querySelectorAll("#content button") ?? [])]
      .find(button => button.textContent.trim() === "Start match" && !button.disabled), "Host Start match");
    startButton.click();
    await waitFor(() => {
      const doc = frameDocument(hostFrame);
      return doc?.body.dataset.partyPhase && doc.body.dataset.partyPhase !== "lobby";
    }, "Game start");
    status(game.name + " is running with " + seats + " real connected test seats. Switch between test controllers as needed.");
    return code;
  }
  function stop() {
    if (cancelled) return;
    cancelled = true;
    roleSelect.replaceChildren();
    for (const frame of views) {
      frame.src = "about:blank"; // close the guest WebSocket on navigation
      frame.remove();
    }
    views = [];
    hostFrame.src = "about:blank";
    code = "";
    $("solo-all-room").textContent = "";
    $("solo-all-seat-note").textContent = "";
  }
  return { start, stop, get selectedSeat() { return selected; } };
}
