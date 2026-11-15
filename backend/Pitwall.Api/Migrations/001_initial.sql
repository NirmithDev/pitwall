CREATE TABLE IF NOT EXISTS replay_sessions (
    id text PRIMARY KEY,
    payload jsonb NOT NULL,
    imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS replay_bookmarks (
    id uuid PRIMARY KEY,
    session_id text NOT NULL REFERENCES replay_sessions(id) ON DELETE CASCADE,
    label varchar(80) NOT NULL,
    elapsed_seconds double precision NOT NULL CHECK (elapsed_seconds >= 0),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_bookmarks_session ON replay_bookmarks(session_id, elapsed_seconds);
