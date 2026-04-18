
-- Remove the unscoped avatars upload policy from storage.objects
DROP POLICY IF EXISTS "Authenticated upload avatars" ON storage.objects;
