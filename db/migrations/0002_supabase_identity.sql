-- Keep the applied initial migration immutable. New accounts use Supabase Auth IDs.
ALTER TABLE scenelog.archive_owners RENAME COLUMN firebase_uid TO user_id;
ALTER TABLE scenelog.archive_movies RENAME COLUMN firebase_uid TO user_id;
ALTER TABLE scenelog.viewing_logs RENAME COLUMN firebase_uid TO user_id;
ALTER TABLE scenelog.watchlist RENAME COLUMN firebase_uid TO user_id;

-- Only the Next.js database connection accesses these tables, never the Data API.
REVOKE ALL ON SCHEMA scenelog FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA scenelog FROM PUBLIC;
ALTER TABLE scenelog.archive_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenelog.archive_movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenelog.viewing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenelog.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenelog.schema_migrations ENABLE ROW LEVEL SECURITY;
