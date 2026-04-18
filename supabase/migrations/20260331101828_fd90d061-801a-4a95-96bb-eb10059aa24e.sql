
-- Drop the pre-existing policy that conflicts
DROP POLICY IF EXISTS "Admin reads team documents" ON public.student_documents;

-- Re-create with updated definition
CREATE POLICY "Admin reads team documents" ON public.student_documents
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND (
    agent_id = auth.uid() OR agent_id IN (SELECT id FROM profiles WHERE admin_id = auth.uid())
  ));

-- The rest was already created. Now add missing policies for admin
CREATE POLICY "Admin inserts own documents v2" ON public.student_documents
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND uploaded_by = auth.uid());

CREATE POLICY "Admin updates team documents" ON public.student_documents
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND (
    agent_id = auth.uid() OR agent_id IN (SELECT id FROM profiles WHERE admin_id = auth.uid())
  ));

CREATE POLICY "Admin deletes team documents" ON public.student_documents
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND (
    agent_id = auth.uid() OR agent_id IN (SELECT id FROM profiles WHERE admin_id = auth.uid())
  ));
