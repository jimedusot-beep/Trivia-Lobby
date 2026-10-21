import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECK_BACKUP_FORMAT, exportDeckCsv, exportDeckJson, parseDeckContent } from "./deck-io";

const sample = {
  title: "Biology, 101",
  description: "Lecture \"notes\"",
  category: "College",
  cards: [
    { front: 'What is "DNA"?', back: "Deoxyribonucleic acid", type: "flashcard", options: [], correctOption: null },
    { front: "Which is a cell?", back: "Neuron", type: "multiple_choice", options: ["Rock", "Neuron"], correctOption: "B" },
  ],
};

describe("Trivia Lobby deck file interchange", () => {
  it("round-trips JSON backups without database IDs", () => {
    const serialized = exportDeckJson(sample);
    const parsed = parseDeckContent(serialized, "bio.json");
    assert.equal(JSON.parse(serialized).format, DECK_BACKUP_FORMAT);
    assert.equal(parsed.title, "Biology, 101");
    assert.equal(parsed.cards.length, 2);
    assert.equal(parsed.cards[1].correctOption, "B");
    assert.equal(serialized.includes('"deckId"'), false);
  });

  it("round-trips CSV with quoted commas and quotes", () => {
    const parsed = parseDeckContent(exportDeckCsv(sample), "bio.csv");
    assert.equal(parsed.cards.length, 2);
    assert.equal(parsed.cards[0].front, 'What is "DNA"?');
    assert.equal(parsed.cards[1].correctOption, "B");
  });

  it("imports tab-separated data with alternate column names", () => {
    const parsed = parseDeckContent("Question\tAnswer\tType\nEarth?\tPlanet\tflashcard", "questions.tsv");
    assert.equal(parsed.cards[0].front, "Earth?");
    assert.equal(parsed.cards[0].back, "Planet");
  });

  it("rejects an invalid multiple-choice answer", () => {
    assert.throws(
      () => parseDeckContent("Front,Back,Type,OptionA,OptionB,CorrectOption\nPick one,Two,multiple_choice,One,Two,D", "invalid.csv"),
      /correct answer/,
    );
  });

  it("rejects empty rows instead of silently dropping cards", () => {
    assert.throws(
      () => parseDeckContent("Front,Back\nGood,Answer\nBad,", "invalid.csv"),
      /front and back/,
    );
  });

  it("rejects missing earlier answer options rather than shifting A/B letters", () => {
    assert.throws(
      () => parseDeckContent("Front,Back,Type,OptionA,OptionB,OptionC,CorrectOption\nQuestion,Answer,multiple_choice,A,,C,C", "bad.csv"),
      /contiguous/,
    );
  });

  it("rejects unknown JSON instead of treating it as a deck backup", () => {
    assert.throws(() => parseDeckContent('{"cards":[]}', "unknown.json"), /Unsupported JSON backup format/);
  });

  it("accepts UTF-8 BOM on imported text", () => {
    const parsed = parseDeckContent("\uFEFFFront,Back\nQuestion,Answer", "deck.csv");
    assert.equal(parsed.cards.length, 1);
  });
});
