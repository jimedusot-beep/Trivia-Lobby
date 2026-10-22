BEGIN;
ALTER TABLE library_files ADD COLUMN IF NOT EXISTS extracted_text text NOT NULL DEFAULT '';
ALTER TABLE library_files ADD COLUMN IF NOT EXISTS course text NOT NULL DEFAULT '';
ALTER TABLE library_files ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS library_files_contents_idx ON library_files USING gin(to_tsvector('simple', extracted_text));
CREATE TABLE IF NOT EXISTS import_receipts (
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  deck_id integer NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id, fingerprint)
);
CREATE TABLE IF NOT EXISTS author_drafts (
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id integer NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  body jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id, deck_id)
);
CREATE TABLE IF NOT EXISTS question_attempts (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id integer NOT NULL REFERENCES universal_questions(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  correct boolean NOT NULL,
  response_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, request_id)
);
CREATE INDEX IF NOT EXISTS question_attempts_owner_time_idx ON question_attempts(owner_id, created_at);
CREATE TABLE IF NOT EXISTS question_schedule (
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id integer NOT NULL REFERENCES universal_questions(id) ON DELETE CASCADE,
  fsrs_state jsonb NOT NULL,
  due_at timestamptz NOT NULL,
  needs_work boolean NOT NULL DEFAULT false,
  PRIMARY KEY(owner_id,question_id)
);
ALTER TABLE study_sources ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES library_files(id) ON DELETE SET NULL;
ALTER TABLE study_drafts ADD COLUMN IF NOT EXISTS published_question_id integer REFERENCES universal_questions(id) ON DELETE SET NULL;
COMMIT;
