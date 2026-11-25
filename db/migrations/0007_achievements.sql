ALTER TABLE scenelog.profiles ADD COLUMN equipped_title text NOT NULL DEFAULT 'first-seat';
CREATE TABLE scenelog.user_achievements (
  user_id text NOT NULL REFERENCES scenelog.profiles(user_id) ON DELETE CASCADE,
  title_id text NOT NULL CHECK (length(title_id) BETWEEN 1 AND 80),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, title_id)
);
INSERT INTO scenelog.user_achievements (user_id, title_id, unlocked_at)
SELECT user_id, 'first-seat', created_at FROM scenelog.profiles;
CREATE FUNCTION scenelog.grant_starter_title() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO scenelog.user_achievements (user_id, title_id, unlocked_at) VALUES (NEW.user_id, 'first-seat', NEW.created_at);
  RETURN NEW;
END $$;
CREATE TRIGGER profile_starter_title AFTER INSERT ON scenelog.profiles
FOR EACH ROW EXECUTE FUNCTION scenelog.grant_starter_title();
REVOKE ALL ON scenelog.user_achievements FROM PUBLIC;
ALTER TABLE scenelog.user_achievements ENABLE ROW LEVEL SECURITY;
