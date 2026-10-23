-- Keep personal learning history after a card, visual question, or deck is deleted.
-- Run after 0005_integrated_platform.sql. Existing history is backfilled using
-- the current available wording; future events snapshot wording at review time.
BEGIN;
ALTER TABLE study_events
  ADD COLUMN IF NOT EXISTS original_card_id integer,
  ADD COLUMN IF NOT EXISTS original_deck_id integer,
  ADD COLUMN IF NOT EXISTS front_snapshot text,
  ADD COLUMN IF NOT EXISTS deck_title_snapshot text,
  ADD COLUMN IF NOT EXISTS subject_snapshot text;
UPDATE study_events se SET
  original_card_id = COALESCE(se.original_card_id, c.id),
  original_deck_id = COALESCE(se.original_deck_id, c.deck_id),
  front_snapshot = COALESCE(se.front_snapshot, c.front),
  deck_title_snapshot = COALESCE(se.deck_title_snapshot, d.title),
  subject_snapshot = COALESCE(se.subject_snapshot, d.category, 'General')
FROM cards c JOIN decks d ON d.id = c.deck_id
WHERE se.card_id = c.id AND (
  se.original_card_id IS NULL OR se.original_deck_id IS NULL OR
  se.front_snapshot IS NULL OR se.deck_title_snapshot IS NULL OR se.subject_snapshot IS NULL
);
DO $ BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='study_events'::regclass
    AND attname='card_id' AND attnotnull) THEN
    ALTER TABLE study_events ALTER COLUMN card_id DROP NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='study_events'::regclass
    AND conname='study_events_card_id_retained_fk') THEN
    ALTER TABLE study_events DROP CONSTRAINT IF EXISTS study_events_card_id_fkey;
    ALTER TABLE study_events DROP CONSTRAINT IF EXISTS study_events_card_id_cards_id_fk;
    ALTER TABLE study_events ADD CONSTRAINT study_events_card_id_retained_fk
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL;
  END IF;
END $;
CREATE INDEX IF NOT EXISTS study_events_original_card_idx ON study_events (user_id, original_card_id);

ALTER TABLE question_attempts
  ADD COLUMN IF NOT EXISTS original_question_id integer,
  ADD COLUMN IF NOT EXISTS original_deck_id integer,
  ADD COLUMN IF NOT EXISTS prompt_snapshot text,
  ADD COLUMN IF NOT EXISTS deck_title_snapshot text,
  ADD COLUMN IF NOT EXISTS subject_snapshot text;
UPDATE question_attempts qa SET
  original_question_id = COALESCE(qa.original_question_id, uq.id),
  original_deck_id = COALESCE(qa.original_deck_id, uq.deck_id),
  prompt_snapshot = COALESCE(qa.prompt_snapshot, uq.definition->>'prompt'),
  deck_title_snapshot = COALESCE(qa.deck_title_snapshot, d.title),
  subject_snapshot = COALESCE(qa.subject_snapshot, d.category, 'General')
FROM universal_questions uq JOIN decks d ON d.id=uq.deck_id
WHERE qa.question_id=uq.id AND (
  qa.original_question_id IS NULL OR qa.original_deck_id IS NULL OR
  qa.prompt_snapshot IS NULL OR qa.deck_title_snapshot IS NULL OR qa.subject_snapshot IS NULL
);
DO $ BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='question_attempts'::regclass
    AND attname='question_id' AND attnotnull) THEN
    ALTER TABLE question_attempts ALTER COLUMN question_id DROP NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='question_attempts'::regclass
    AND conname='question_attempts_question_id_retained_fk') THEN
    ALTER TABLE question_attempts DROP CONSTRAINT IF EXISTS question_attempts_question_id_fkey;
    ALTER TABLE question_attempts DROP CONSTRAINT IF EXISTS question_attempts_question_id_universal_questions_id_fk;
    ALTER TABLE question_attempts ADD CONSTRAINT question_attempts_question_id_retained_fk
      FOREIGN KEY (question_id) REFERENCES universal_questions(id) ON DELETE SET NULL;
  END IF;
END $;
CREATE INDEX IF NOT EXISTS question_attempts_original_question_idx ON question_attempts (owner_id, original_question_id);
COMMIT;
