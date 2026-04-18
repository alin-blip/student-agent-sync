
-- Migration 1: Fix students table policies from {public} to {authenticated}

DROP POLICY IF EXISTS "Admin inserts own students" ON public.students;
DROP POLICY IF EXISTS "Admin sees own students" ON public.students;
DROP POLICY IF EXISTS "Admin sees team students" ON public.students;
DROP POLICY IF EXISTS "Agent inserts own students" ON public.students;
DROP POLICY IF EXISTS "Agent sees own students" ON public.students;
DROP POLICY IF EXISTS "Agent updates own students" ON public.students;
DROP POLICY IF EXISTS "Owner manages all students" ON public.students;
DROP POLICY IF EXISTS "Owner sees all students" ON public.students;

CREATE POLICY "Admin inserts own students" ON public.students FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND (agent_id = auth.uid()));

CREATE POLICY "Admin sees own students" ON public.students FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND (agent_id = auth.uid()));

CREATE POLICY "Admin sees team students" ON public.students FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND (agent_id IN (SELECT profiles.id FROM profiles WHERE profiles.admin_id = auth.uid())));

CREATE POLICY "Agent inserts own students" ON public.students FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agent sees own students" ON public.students FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agent updates own students" ON public.students FOR UPDATE TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Owner manages all students" ON public.students FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owner sees all students" ON public.students FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));
