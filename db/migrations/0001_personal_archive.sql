-- Firebase owns login identities. Only the verified UID is persisted here.
CREATE TABLE scenelog.archive_owners (
  firebase_uid text PRIMARY KEY CHECK (length(firebase_uid) BETWEEN 1 AND 128),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740990),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Private movie snapshots; client metadata must not overwrite a shared TMDB cache.
CREATE TABLE scenelog.archive_movies (
  firebase_uid text NOT NULL REFERENCES scenelog.archive_owners(firebase_uid) ON DELETE CASCADE,
  movie_id text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  metadata jsonb NOT NULL CHECK (jsonb_typeof(metadata) = 'object' AND metadata ? 'id' AND metadata->>'id' = movie_id),
  PRIMARY KEY (firebase_uid, movie_id)
);

CREATE TABLE scenelog.viewing_logs (
  firebase_uid text NOT NULL,
  id text NOT NULL,
  movie_id text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  rating_tenths smallint CHECK (rating_tenths BETWEEN 0 AND 50),
  watched_on date,
  review text NOT NULL CHECK (length(review) <= 5000),
  themes jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(themes) = 'object'),
  tier text CHECK (tier IN ('S', 'A', 'B', 'C', 'D')),
  spoiler boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (firebase_uid, id),
  FOREIGN KEY (firebase_uid, movie_id) REFERENCES scenelog.archive_movies(firebase_uid, movie_id) ON DELETE CASCADE
);
CREATE INDEX viewing_logs_user_movie_idx ON scenelog.viewing_logs(firebase_uid, movie_id);
CREATE INDEX viewing_logs_user_date_idx ON scenelog.viewing_logs(firebase_uid, watched_on);

CREATE TABLE scenelog.watchlist (
  firebase_uid text NOT NULL,
  movie_id text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (firebase_uid, movie_id),
  FOREIGN KEY (firebase_uid, movie_id) REFERENCES scenelog.archive_movies(firebase_uid, movie_id) ON DELETE CASCADE
);
