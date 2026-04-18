
-- Resources table
CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'guides',
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read resources
CREATE POLICY "Authenticated read resources"
ON public.resources FOR SELECT
TO authenticated
USING (true);

-- Owner full access
CREATE POLICY "Owner manages resources"
ON public.resources FOR ALL
TO public
USING (has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

-- Admin can insert and delete own resources
CREATE POLICY "Admin inserts resources"
ON public.resources FOR INSERT
TO public
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND uploaded_by = auth.uid());

CREATE POLICY "Admin deletes own resources"
ON public.resources FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::app_role) AND uploaded_by = auth.uid());

-- Storage bucket for resource files
INSERT INTO storage.buckets (id, name, public)
VALUES ('resource-files', 'resource-files', true);

-- Storage policies
CREATE POLICY "Authenticated read resource files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resource-files');

CREATE POLICY "Owner upload resource files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resource-files' AND has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admin upload resource files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resource-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner delete resource files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resource-files' AND has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admin delete own resource files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resource-files' AND has_role(auth.uid(), 'admin'::app_role));
