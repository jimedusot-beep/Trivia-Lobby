BEGIN;
CREATE TABLE IF NOT EXISTS live_game_sessions (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id integer REFERENCES decks(id) ON DELETE SET NULL,
  deck_title text NOT NULL,
  mode text NOT NULL DEFAULT 'classic',
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  leaderboard jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS live_game_sessions_owner_created_idx ON live_game_sessions(owner_id,created_at DESC);
CREATE TABLE IF NOT EXISTS live_game_rounds (
  session_id uuid NOT NULL REFERENCES live_game_sessions(id) ON DELETE CASCADE,
  question_index integer NOT NULL CHECK(question_index >= 0),
  prompt text NOT NULL,
  kind text NOT NULL,
  options jsonb NOT NULL,
  correct_answers jsonb NOT NULL,
  duration_ms integer NOT NULL CHECK(duration_ms > 0),
  player_answers jsonb NOT NULL,
  revealed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(session_id,question_index)
);
COMMIT;
