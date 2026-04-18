
INSERT INTO storage.buckets (id, name, public) VALUES ('student-documents', 'student-documents', false);

CREATE POLICY "Agent uploads docs for own students"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'student-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text FROM public.students s WHERE s.agent_id = auth.uid()
  )
);

CREATE POLICY "Agent views own student docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'student-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text FROM public.students s WHERE s.agent_id = auth.uid()
  )
);

CREATE POLICY "Admin views team student docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'student-documents'
  AND public.has_role(auth.uid(), 'admin')
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text FROM public.students s
    JOIN public.profiles p ON s.agent_id = p.id
    WHERE p.admin_id = auth.uid()
  )
);

CREATE POLICY "Owner full access student docs"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'student-documents'
  AND public.has_role(auth.uid(), 'owner')
)
WITH CHECK (
  bucket_id = 'student-documents'
  AND public.has_role(auth.uid(), 'owner')
);

CREATE POLICY "Agent deletes own student docs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'student-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text FROM public.students s WHERE s.agent_id = auth.uid()
  )
);
