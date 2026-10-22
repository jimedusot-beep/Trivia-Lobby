BEGIN;
CREATE TABLE IF NOT EXISTS decks (
 id serial PRIMARY KEY,title text NOT NULL,description text,category text DEFAULT 'General',created_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cards (
 id serial PRIMARY KEY,deck_id integer NOT NULL,type text NOT NULL DEFAULT 'flashcard',front text NOT NULL,back text NOT NULL,
 options jsonb,correct_option text,created_at timestamp DEFAULT now()
);
COMMIT;
