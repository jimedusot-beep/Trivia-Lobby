-- Phase 2 additive migration: execute before deploying the Phase 2 API.
-- The existing decks/cards tables and their data are not changed.
BEGIN;
CREATE TABLE IF NOT EXISTS universal_questions (
  id SERIAL PRIMARY KEY,
  deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT universal_questions_definition_object CHECK (jsonb_typeof(definition) = 'object')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_universal_question_deck_fingerprint
  ON universal_questions(deck_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_universal_question_deck_position
  ON universal_questions(deck_id, position);
COMMIT;
