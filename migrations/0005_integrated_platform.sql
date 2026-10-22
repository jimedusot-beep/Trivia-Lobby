BEGIN;
ALTER TABLE library_files ADD COLUMN IF NOT EXISTS storage_backend text NOT NULL DEFAULT 'filesystem';
ALTER TABLE library_files ADD COLUMN IF NOT EXISTS content_text text NOT NULL DEFAULT '';
ALTER TABLE library_files ADD COLUMN IF NOT EXISTS course text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS library_files_content_idx ON library_files USING gin(to_tsvector('simple', content_text));
CREATE TABLE IF NOT EXISTS import_receipts (
 owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 fingerprint text NOT NULL, deck_id integer NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
 PRIMARY KEY(owner_id, fingerprint)
);
CREATE TABLE IF NOT EXISTS author_drafts (
 owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 deck_id integer NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
 payload jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_id, deck_id)
);
CREATE TABLE IF NOT EXISTS question_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 question_id integer NOT NULL REFERENCES universal_questions(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, correct boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS question_attempt_request_idx ON question_attempts(user_id, request_id);
ALTER TABLE study_sources ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES library_files(id) ON DELETE SET NULL;
ALTER TABLE study_drafts ADD COLUMN IF NOT EXISTS published_question_id integer REFERENCES universal_questions(id) ON DELETE SET NULL;
COMMIT;
