ALTER TABLE scenelog.profiles ADD COLUMN avatar_path text
  CHECK (avatar_path IS NULL OR (length(avatar_path) <= 256 AND avatar_path ~ '^[a-zA-Z0-9_-]+/[a-f0-9-]+\.webp$'));
