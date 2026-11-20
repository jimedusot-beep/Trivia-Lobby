import test from "node:test";
import assert from "node:assert/strict";
import * as locale from "../public/i18n.js";
import { guestGames } from "../public/game-catalog.js";

test("all 31 game titles have Spanish display names without changing canonical catalog data", () => {
  const before = JSON.stringify(guestGames); locale.setLocale("es");
  for (const game of guestGames) {
    const display = locale.localizeGame(game);
    assert.notEqual(display.name, game.name, game.id);
    assert.notEqual(display.rules, game.rules, game.id + " rules");
    assert.notEqual(display.rounds, game.rounds, game.id + " rounds");
    assert.equal(display.id, game.id); assert.equal(display.min, game.min); assert.equal(display.max, game.max);
  }
  assert.equal(guestGames.length, 31); assert.equal(JSON.stringify(guestGames), before);
  locale.setLocale("en"); for (const game of guestGames) assert.equal(locale.localizeGame(game), game);
});

test("bilingual identity has matching English and Spanish first-party copy", () => {
  locale.setLocale("es");
  assert.equal(locale.t("Two languages. One party."), "Dos idiomas. Una fiesta.");
  assert.equal(locale.t("Play together."), "Juega en compañía.");
  assert.equal(locale.t("Everyone plays."), "Todo el mundo juega.");
  locale.setLocale("en"); assert.equal(locale.t("Two languages. One party."), "Two languages. One party.");
});

test("the shared language subscription notifies this document and can unsubscribe", () => {
  const original = globalThis.document, doc = new EventTarget(); doc.documentElement = { lang: "en" }; globalThis.document = doc;
  try {
    locale.setLocale("en"); let notices = 0; const unsubscribe = locale.subscribeLocale(() => notices++);
    locale.setLocale("es"); assert.equal(notices, 1); assert.equal(doc.documentElement.lang, "es");
    unsubscribe(); locale.setLocale("en"); assert.equal(notices, 1);
  } finally { if (original === undefined) delete globalThis.document; else globalThis.document = original; locale.setLocale("en"); }
});

test("explicit accessibility translations preserve input values and unrelated attributes", () => {
  locale.setLocale("es"); const attrs = {}, field = { dataset: { i18nAriaLabel: "Find your next game", i18nPlaceholder: "Find your next game" }, value: "Mi familia — untouched", setAttribute: (key,value) => attrs[key]=value };
  locale.translateStatic({ querySelectorAll: selector => selector === "[data-i18n]" ? [] : selector.includes("aria-label") || selector.includes("placeholder") ? [field] : [] });
  assert.equal(attrs["aria-label"], "Encuentra tu próximo juego"); assert.equal(attrs.placeholder, "Encuentra tu próximo juego"); assert.equal(field.value, "Mi familia — untouched");
  locale.setLocale("en");
});

test("unknown authored text never becomes translated game content", () => {
  locale.setLocale("es"); const custom = { id: "custom", name: "Abuela's special quiz", rules: "Keep my exact wording" };
  assert.equal(locale.localizeGame(custom).name, custom.name); assert.equal(locale.localizeGame(custom).rules, custom.rules); assert.equal(locale.t("José — Equipo Azul"), "José — Equipo Azul"); locale.setLocale("en");
});
