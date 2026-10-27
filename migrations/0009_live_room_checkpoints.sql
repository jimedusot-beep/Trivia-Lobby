BEGIN;

-- Private server authority; no browser API exposes this table or the stored credential hashes.
CREATE TABLE IF NOT EXISTS live_room_checkpoints (
  kind text NOT NULL CHECK (kind IN ('party','quiz')),
  code text NOT NULL CHECK (code ~ '^[A-Z2-9]{6}$'),
  version bigint NOT NULL CHECK (version > 0),
  state jsonb NOT NULL,
  payload_bytes integer NOT NULL CHECK (payload_bytes > 0 AND payload_bytes <= 4194304),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (kind,code)
);
CREATE INDEX IF NOT EXISTS live_room_checkpoints_expiry ON live_room_checkpoints(expires_at);
CREATE SEQUENCE IF NOT EXISTS live_room_checkpoint_version AS bigint;

-- A single statement makes write/ack ordering practical on the existing free database.
CREATE OR REPLACE FUNCTION save_live_room_checkpoint(
  p_kind text, p_code text, p_state jsonb, p_expires_at timestamptz, p_expected_version bigint
) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  previous live_room_checkpoints%ROWTYPE;
  next_version bigint;
  bytes integer := octet_length(p_state::text);
  total_bytes bigint;
  room_count bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(78682026);
  DELETE FROM live_room_checkpoints WHERE expires_at <= clock_timestamp();
  SELECT * INTO previous FROM live_room_checkpoints WHERE kind=p_kind AND code=p_code FOR UPDATE;
  IF previous.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'Room checkpoint conflict';
  END IF;
  IF bytes > 4194304 THEN RAISE EXCEPTION 'Room checkpoint too large'; END IF;
  IF p_expires_at IS NULL OR p_expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'Checkpoint expiry is invalid'; END IF;
  SELECT COALESCE(sum(payload_bytes),0), count(*) INTO total_bytes, room_count FROM live_room_checkpoints;
  IF total_bytes - COALESCE(previous.payload_bytes,0) + bytes > 33554432
     OR (previous.version IS NULL AND room_count >= 700) THEN
    RAISE EXCEPTION 'Room checkpoint capacity reached';
  END IF;
  -- Never reuse a fencing version when an expired code is allocated to another room.
  next_version := nextval('live_room_checkpoint_version');
  INSERT INTO live_room_checkpoints(kind,code,version,state,payload_bytes,expires_at,updated_at)
    VALUES(p_kind,p_code,next_version,p_state,bytes,p_expires_at,clock_timestamp())
    ON CONFLICT(kind,code) DO UPDATE SET version=EXCLUDED.version,state=EXCLUDED.state,
      payload_bytes=EXCLUDED.payload_bytes,expires_at=EXCLUDED.expires_at,updated_at=EXCLUDED.updated_at;
  RETURN next_version;
END;
$$;
COMMIT;
