// Invitation entry is a presentation choice. Only the server can admit a guest.
export function mountInvitationEntry({ search, savedParty, partyUrl }) {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(search);
  const raw = (params.get("code") || "").trim().toUpperCase();
  const validCode = value => /^[A-HJ-NP-Z2-9]{6}$/.test(value);
  const code = validCode(raw) ? raw : null;
  const invited = params.has("code");
  const showError = message => {
    $("join-error").textContent = message;
    $("join-error").hidden = !message;
  };
  $("code").value = code || "";
  if (invited) {
    document.body.classList.add("party-invited");
    $("party-intro").hidden = true;
    $("host-entry").hidden = true;
    $("pick-games").hidden = true;
    $("join-default-intro").hidden = true;
    $("invite-intro").hidden = false;
    $("invited-room-code").textContent = code || "Enter a code below";
    $("code-fields").hidden = !!code;
    $("change-code").hidden = !code;
    $("join-footnote").textContent = "New players join while the host is in the lobby.";
    const otherParty = savedParty && validCode(savedParty.code) && savedParty.code !== code;
    $("other-party").hidden = !otherParty;
    if (otherParty) {
      $("other-party-note").textContent = `You're ${savedParty.actor === "host" ? "hosting" : "in"} room ${savedParty.code}. Return there, or enter a nickname to join this party.`;
      $("return-to-party").href = partyUrl.href;
      $("return-to-party").textContent = `Return to room ${savedParty.code}`;
    }
    $("browse-games").hidden = !!otherParty;
    $("browse-games").href = partyUrl.href;
    $("change-code").onclick = () => {
      $("code-fields").hidden = false;
      $("change-code").hidden = true;
      $("code").focus();
      $("code").select();
    };
    $("code").addEventListener("input", () => {
      const value = $("code").value.trim().toUpperCase();
      $("invited-room-code").textContent = validCode(value) ? value : "Enter a code below";
    });
    if (!code) showError("This invitation needs a valid six-character party code. Ask the host for a new QR code, or enter the code below.");
    (code ? $("name") : $("code")).focus({ preventScroll: true });
  }
  return {
    resumeSavedParty: !invited || code === savedParty?.code,
    showError,
    clearError: () => showError(""),
  };
}
