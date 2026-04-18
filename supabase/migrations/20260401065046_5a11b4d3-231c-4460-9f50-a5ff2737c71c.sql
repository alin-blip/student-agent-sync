
-- Fix generated-images bucket: add ownership check to INSERT policy
DROP POLICY IF EXISTS "Authenticated upload generated images" ON storage.objects;

CREATE POLICY "Authenticated upload generated images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'generated-images' AND (storage.foldername(name))[1] = auth.uid()::text);
