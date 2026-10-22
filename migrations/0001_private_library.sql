-- Phase 3 additive migration; run once with psql -v ON_ERROR_STOP=1 -f migrations/0001_private_library.sql
-- Back up PostgreSQL first. Legacy decks remain ownerless and are not exposed.
BEGIN;
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_expiry_idx ON user_sessions(expires_at);
ALTER TABLE decks ADD COLUMN IF NOT EXISTS owner_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'decks_owner_id_users_id_fk' AND conrelid='decks'::regclass) THEN
    ALTER TABLE decks ADD CONSTRAINT decks_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS decks_owner_idx ON decks(owner_id);
CREATE INDEX IF NOT EXISTS cards_deck_idx ON cards(deck_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cards_deck_id_decks_id_fk' AND conrelid='cards'::regclass) THEN
    -- Existing orphans cannot block migration; all new/updated rows are checked.
    ALTER TABLE cards ADD CONSTRAINT cards_deck_id_decks_id_fk FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS library_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 8388608),
  sha256 text NOT NULL,
  object_key text NOT NULL UNIQUE,
  import_status text NOT NULL DEFAULT 'uploaded',
  folder text NOT NULL DEFAULT 'Unfiled',
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT library_files_sha256_format CHECK (sha256 ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS library_files_owner_hash_idx ON library_files(owner_id, sha256);
CREATE INDEX IF NOT EXISTS library_files_owner_date_idx ON library_files(owner_id, created_at);
CREATE TABLE IF NOT EXISTS deck_sources (
  deck_id integer NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES library_files(id) ON DELETE CASCADE,
  PRIMARY KEY(deck_id, file_id)
);
COMMIT;
