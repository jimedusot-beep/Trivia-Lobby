BEGIN;
CREATE TABLE IF NOT EXISTS quiz_assignments (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id integer REFERENCES decks(id) ON DELETE SET NULL,
  title text NOT NULL,
  questions jsonb NOT NULL,
  opens_at timestamptz,
  closes_at timestamptz,
  max_attempts integer NOT NULL DEFAULT 1 CHECK(max_attempts BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at)
);
CREATE INDEX IF NOT EXISTS quiz_assignments_owner_created_idx ON quiz_assignments(owner_id,created_at DESC);
CREATE TABLE IF NOT EXISTS quiz_assignment_attempts (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES quiz_assignments(id) ON DELETE CASCADE,
  participant_name text NOT NULL,
  secret_hash text NOT NULL UNIQUE,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  score integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quiz_attempts_assignment_idx ON quiz_assignment_attempts(assignment_id,created_at);
COMMIT;
