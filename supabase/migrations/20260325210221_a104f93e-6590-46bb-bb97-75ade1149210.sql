-- Create student_documents table for metadata tracking
CREATE TABLE public.student_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  doc_type text NOT NULL DEFAULT 'Other',
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;

-- Owner manages all
CREATE POLICY "Owner manages all documents"
  ON public.student_documents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Admin reads team documents
CREATE POLICY "Admin reads team documents"
  ON public.student_documents FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') AND (
      agent_id = auth.uid() OR
      agent_id IN (SELECT id FROM public.profiles WHERE admin_id = auth.uid())
    )
  );

-- Admin inserts own documents
CREATE POLICY "Admin inserts own documents"
  ON public.student_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') AND uploaded_by = auth.uid()
  );

-- Admin deletes own documents
CREATE POLICY "Admin deletes own documents"
  ON public.student_documents FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') AND uploaded_by = auth.uid()
  );

-- Agent manages own students' documents
CREATE POLICY "Agent manages own documents"
  ON public.student_documents FOR ALL
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());