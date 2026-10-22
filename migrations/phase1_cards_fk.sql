-- Phase 1: fail safely if legacy cards point to missing decks.
-- Run after backing up PostgreSQL; apply as one transaction.
BEGIN;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cards c LEFT JOIN decks d ON d.id = c.deck_id
    WHERE d.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Orphan cards found; repair references before adding FK';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cards_deck_id_decks_id_fk'
  ) THEN
    ALTER TABLE cards
      ADD CONSTRAINT cards_deck_id_decks_id_fk
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS cards_deck_id_idx ON cards(deck_id);
COMMIT;
