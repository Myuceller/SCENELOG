CREATE TABLE scenelog.profiles (
  user_id text PRIMARY KEY CHECK (length(user_id) BETWEEN 1 AND 128),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 30),
  collection_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scenelog.follows (
  follower_id text NOT NULL REFERENCES scenelog.profiles(user_id) ON DELETE CASCADE,
  following_id text NOT NULL REFERENCES scenelog.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX follows_following_idx ON scenelog.follows (following_id, created_at DESC);

-- Existing members become discoverable under a neutral nickname; no email is published.
-- Their archives remain private until they explicitly enable collection sharing.
INSERT INTO scenelog.profiles (user_id, display_name)
SELECT user_id, '영화친구 ' || left(user_id, 8) FROM scenelog.archive_owners;

REVOKE ALL ON scenelog.profiles, scenelog.follows FROM PUBLIC;
ALTER TABLE scenelog.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenelog.follows ENABLE ROW LEVEL SECURITY;
