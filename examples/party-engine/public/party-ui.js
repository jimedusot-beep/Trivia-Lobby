// Presentation only. No game state, scoring, storage or network access.
export function celebrate() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelector(".lobby-confetti")?.remove();
  const burst = document.createElement("div");
  burst.className = "lobby-confetti";
  burst.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 12; i++) burst.append(document.createElement("i"));
  document.body.append(burst);
  setTimeout(() => burst.remove(), 1100);
}
