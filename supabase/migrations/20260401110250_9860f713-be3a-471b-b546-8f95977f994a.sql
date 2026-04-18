
DROP POLICY IF EXISTS "Agent manages own documents" ON public.student_documents;

CREATE POLICY "Agent reads own documents"
  ON public.student_documents FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agent inserts own documents"
  ON public.student_documents FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid());
