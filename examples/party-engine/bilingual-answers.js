// Reviewed aliases for the original fixed starter packs only.
// Server owns answer validation; never trust a client-supplied language or answer key.
// Do NOT use arbitrary translation, substring matching or fuzzy spelling for scoring.
export function normalizeAnswer(text) {
  if (typeof text !== "string") return "";
  return text.normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Each inner list is indexed by the canonical English answer's rank, so a
// translated answer earns exactly the same points as its English equivalent.
const surveySpanish = Object.freeze([
  [ // Packing for vacation
    ["pasaporte"],
    ["cepillo de dientes"],
    ["cargador de telefono", "cargador del telefono", "cargador de celular", "cargador del movil"],
    ["boletos", "boleto", "entradas", "entrada", "billetes", "pasajes", "pasaje", "boletos de avión", "billetes de avión"],
    ["protector solar", "bloqueador solar", "crema solar"],
  ],
  [ // Movie theater
    ["palomitas", "palomitas de maiz", "cotufas", "pochoclo", "crispetas", "canguil", "canchita"],
    ["asientos", "butacas"],
    ["pantalla"],
    ["boletos", "boleto", "entradas", "entrada"],
    ["refresco", "gaseosa", "soda", "bebida gaseosa"],
  ],
  [ // Pancakes
    ["sirope", "jarabe", "jarabe de arce", "jarabe de maple", "miel de maple", "miel de arce"],
    ["mantequilla"],
    ["fruta", "frutas"],
    ["chocolate"],
    ["crema batida", "nata montada"],
  ],
  [ // Beach
    ["toalla"],
    ["protector solar", "bloqueador solar", "crema solar"],
    ["sombrilla", "paraguas"],
    ["gafas de sol", "lentes de sol"],
    ["agua"],
  ],
  [ // Refrigerator
    ["leche"],
    ["huevos"],
    ["queso"],
    ["verduras", "vegetales"],
    ["jugo", "zumo"],
  ],
]);

export function surveyAnswerIndex(round, answer, canonicalItems) {
  if (!Number.isInteger(round) || !Array.isArray(canonicalItems) ||
      !Array.isArray(surveySpanish[round])) return -1;
  const key = normalizeAnswer(answer);
  if (!key) return -1;
  for (let index = 0; index < canonicalItems.length; index++) {
    if (key === normalizeAnswer(canonicalItems[index])) return index;
    if (surveySpanish[round][index]?.some(alias => key === normalizeAnswer(alias))) return index;
  }
  return -1;
}

// Spanish answers are included only if they start with the round's requested
// letter, preserving the actual letter rule. Other English starter answers
// retain their existing scoring. Keys are canonical original English words.
const categorySpanish = Object.freeze([
  { "papaya": ["papaya"], "passion fruit": ["parchita"],
    "pear": ["pera"], "pineapple": ["piña"], "plantain": ["plátano"],
    "pomegranate": [] },
  { "camel": ["camello"], "capybara": ["capibara", "carpincho"],
    "cheetah": ["chita"], "chimpanzee": ["chimpancé"],
    "cobra": ["cobra"], "crocodile": ["cocodrilo"] },
  { "bangkok": ["bangkok"], "barcelona": ["barcelona"],
    "beijing": ["beijing"], "berlin": ["berlín"], "bogota": ["bogotá"],
    "brussels": ["bruselas"], "budapest": ["budapest"],
    "buenos aires": ["buenos aires"] },
  { "salmon": ["salmón"], "sandwich": ["sándwich", "sanduche"],
    "sausage": ["salchicha"], "soup": ["sopa"], "sushi": ["sushi"] },
  { "madagascar": ["madagascar"], "malaysia": ["malasia"],
    "maldives": ["maldivas"], "mali": ["malí"], "malta": ["malta"],
    "mauritania": ["mauritania"], "mexico": ["méxico"],
    "moldova": ["moldavia"], "monaco": ["mónaco"],
    "mongolia": ["mongolia"], "morocco": ["marruecos"],
    "mozambique": ["mozambique"], "myanmar": ["myanmar"] },
]);

export function categoryAnswerKey(round, answer, canonicalWords, letter) {
  if (!Number.isInteger(round) || !Array.isArray(canonicalWords) ||
      !categorySpanish[round] || typeof letter !== "string") return null;
  const key = normalizeAnswer(answer), first = normalizeAnswer(letter);
  if (!key || !first || !key.startsWith(first)) return null;
  for (const word of canonicalWords) {
    const canonical = normalizeAnswer(word);
    if (key === canonical) return canonical;
    const aliases = categorySpanish[round][canonical] ?? [];
    if (aliases.some(alias => key === normalizeAnswer(alias))) return canonical;
  }
  return null;
}
