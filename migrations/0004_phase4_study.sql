BEGIN;
CREATE TABLE IF NOT EXISTS study_schedule (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id integer NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  fsrs_state jsonb NOT NULL,
  due_at timestamptz NOT NULL,
  last_rating integer NOT NULL CHECK(last_rating BETWEEN 1 AND 4),
  needs_work boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);
CREATE INDEX IF NOT EXISTS study_schedule_user_due_idx ON study_schedule(user_id, due_at);
CREATE TABLE IF NOT EXISTS study_events (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id integer NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  request_id uuid NOT NULL, rating integer NOT NULL CHECK(rating BETWEEN 1 AND 4),
  correct boolean NOT NULL,
  due_before timestamptz, due_after timestamptz NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  state_before jsonb NOT NULL, state_after jsonb NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS study_events_user_request_idx ON study_events(user_id,request_id);
CREATE INDEX IF NOT EXISTS study_events_user_time_idx ON study_events(user_id,reviewed_at);
CREATE TABLE IF NOT EXISTS study_sources (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL, body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS study_drafts (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES study_sources(id) ON DELETE CASCADE,
  front text NOT NULL, back text NOT NULL, explanation text, evidence text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE study_drafts ADD COLUMN IF NOT EXISTS explanation text;
CREATE INDEX IF NOT EXISTS study_drafts_user_source_idx ON study_drafts(user_id,source_id);
COMMIT;
