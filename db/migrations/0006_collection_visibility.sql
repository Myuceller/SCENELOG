ALTER TABLE scenelog.profiles ADD COLUMN collection_visibility text NOT NULL DEFAULT 'private'
  CHECK (collection_visibility IN ('private', 'friends', 'public'));

-- Preserve explicit public sharing; all other existing and new profiles stay private.
UPDATE scenelog.profiles SET collection_visibility = CASE WHEN collection_public THEN 'public' ELSE 'private' END;
