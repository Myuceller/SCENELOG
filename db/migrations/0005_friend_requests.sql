CREATE TABLE scenelog.friendships (
  requester_id text NOT NULL REFERENCES scenelog.profiles(user_id) ON DELETE CASCADE,
  recipient_id text NOT NULL REFERENCES scenelog.profiles(user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, recipient_id),
  CHECK (requester_id <> recipient_id)
);

-- One relationship per pair, even when both users send a request at once.
CREATE UNIQUE INDEX friendships_pair_idx ON scenelog.friendships
  (LEAST(requester_id, recipient_id), GREATEST(requester_id, recipient_id));
CREATE INDEX friendships_recipient_idx ON scenelog.friendships (recipient_id, status, created_at DESC);
CREATE INDEX friendships_requester_idx ON scenelog.friendships (requester_id, status, created_at DESC);

-- Following did not imply consent. Do not turn legacy follows into friendships.
REVOKE ALL ON scenelog.friendships FROM PUBLIC;
ALTER TABLE scenelog.friendships ENABLE ROW LEVEL SECURITY;
