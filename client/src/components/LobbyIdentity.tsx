import { Link } from "wouter";
import { useEffect, useState } from "react";

export function LobbyBrand() {
  return <Link href="/" className="lobby-brand">
    <img src="/party/lobby-spark.svg" alt="" width="46" height="46" />
    <span className="lobby-wordmark">Trivia <span>Lobby</span></span>
  </Link>;
}

export function LobbyCelebration() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1100);
    return () => clearTimeout(timer);
  }, []);
  return visible ? <div className="lobby-confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div> : null;
}

/** Original tabletop artwork, drawn with native vectors rather than game assets. */
export function LobbyPartyScene() {
  return <div className="lobby-party-scene" aria-hidden="true">
    <svg viewBox="0 0 560 460" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="286" cy="383" rx="231" ry="34" fill="#20264b" opacity=".1" />
      <path d="M53 118C95 27 236 19 299 55C378 10 504 77 515 186C564 278 481 390 371 379C270 422 124 388 89 321C20 285 18 193 53 118Z" fill="#e6e0ff" />
      <g transform="rotate(-9 284 245)">
        <rect x="104" y="137" width="344" height="235" rx="29" fill="#20264b" />
        <rect x="98" y="127" width="344" height="235" rx="29" fill="#fffaf0" stroke="#20264b" strokeWidth="4" />
        <path d="M132 178H392V312H145V239H330" stroke="#d6d1ec" strokeWidth="6" strokeDasharray="3 14" strokeLinecap="round" />
        <rect x="119" y="150" width="75" height="71" rx="17" fill="#91e5ba" stroke="#20264b" strokeWidth="3" />
        <path d="m141 186 12 12 22-28" stroke="#20264b" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="213" y="150" width="75" height="71" rx="17" fill="#85d9f8" stroke="#20264b" strokeWidth="3" />
        <circle cx="251" cy="185" r="15" stroke="#20264b" strokeWidth="5" />
        <rect x="307" y="150" width="110" height="109" rx="21" fill="#6146df" stroke="#20264b" strokeWidth="3" />
        <text x="362" y="227" textAnchor="middle" fill="white" fontFamily="Fredoka Variable, sans-serif" fontSize="72" fontWeight="600">?</text>
        <rect x="119" y="245" width="75" height="89" rx="17" fill="#ff8a80" stroke="#20264b" strokeWidth="3" />
        <path d="M144 276H170M144 287H164M144 299H170" stroke="#20264b" strokeWidth="5" strokeLinecap="round" />
        <rect x="213" y="281" width="75" height="53" rx="17" fill="#ffda59" stroke="#20264b" strokeWidth="3" />
        <circle cx="240" cy="307" r="5" fill="#20264b" /><circle cx="262" cy="307" r="5" fill="#20264b" />
        <rect x="307" y="281" width="110" height="53" rx="17" fill="#91e5ba" stroke="#20264b" strokeWidth="3" />
        <path d="m350 300 12 14 14-14" stroke="#20264b" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="rotate(14 424 96)"><rect x="373" y="37" width="104" height="104" rx="25" fill="#20264b" /><rect x="368" y="30" width="104" height="104" rx="25" fill="#ff8a80" stroke="#20264b" strokeWidth="4" /><circle cx="395" cy="58" r="8" fill="#20264b" /><circle cx="445" cy="58" r="8" fill="#20264b" /><circle cx="395" cy="108" r="8" fill="#20264b" /><circle cx="445" cy="108" r="8" fill="#20264b" /><circle cx="420" cy="83" r="8" fill="#20264b" /></g>
      <g transform="rotate(9 147 105)"><image href="/party/lobby-spark.svg" x="61" y="10" width="174" height="174" /></g>
      <g transform="rotate(12 449 315)"><path d="M411 277H482Q504 277 504 300V334Q504 357 482 357H451L427 378V357H411Q388 357 388 334V300Q388 277 411 277Z" fill="#20264b" /><path d="M406 271H477Q499 271 499 294V328Q499 351 477 351H446L422 372V351H406Q383 351 383 328V294Q383 271 406 271Z" fill="#85d9f8" stroke="#20264b" strokeWidth="4" /><ellipse cx="422" cy="301" rx="4" ry="6" fill="#20264b" /><ellipse cx="458" cy="301" rx="4" ry="6" fill="#20264b" /><path d="M427 319Q442 331 456 318" stroke="#20264b" strokeWidth="4" strokeLinecap="round" /></g>
      <path d="m44 215 6-17 6 17 17 6-17 6-6 17-6-17-17-6Z" fill="#ffda59" stroke="#20264b" strokeWidth="3" />
      <path d="m491 187 4-12 5 12 12 5-12 4-5 12-4-12-12-4Z" fill="#91e5ba" stroke="#20264b" strokeWidth="3" />
      <circle cx="303" cy="29" r="7" fill="#ff8a80" stroke="#20264b" strokeWidth="3" />
      <circle cx="77" cy="353" r="9" fill="#85d9f8" stroke="#20264b" strokeWidth="3" />
    </svg>
    <span className="scene-sticker">YOUR TABLE. YOUR RULES.</span>
  </div>;
}
