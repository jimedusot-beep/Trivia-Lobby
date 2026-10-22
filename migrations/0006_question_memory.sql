BEGIN;
CREATE TABLE IF NOT EXISTS question_schedule (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 question_id integer NOT NULL REFERENCES universal_questions(id) ON DELETE CASCADE,
 fsrs_state jsonb NOT NULL, due_at timestamptz NOT NULL, last_correct boolean NOT NULL,
 PRIMARY KEY(user_id,question_id)
);
CREATE INDEX IF NOT EXISTS question_schedule_user_due_idx ON question_schedule(user_id,due_at);
COMMIT;
