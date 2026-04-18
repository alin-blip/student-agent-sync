
-- Split agent ALL policy on student_finance_forms into granular SELECT/INSERT/UPDATE (no DELETE)

DROP POLICY IF EXISTS "Agent manages own finance forms" ON public.student_finance_forms;

CREATE POLICY "Agent reads own finance forms" ON public.student_finance_forms FOR SELECT TO authenticated
  USING (student_id IN (SELECT s.id FROM students s WHERE s.agent_id = auth.uid()));

CREATE POLICY "Agent inserts own finance forms" ON public.student_finance_forms FOR INSERT TO authenticated
  WITH CHECK (student_id IN (SELECT s.id FROM students s WHERE s.agent_id = auth.uid()) AND agent_id = auth.uid());

CREATE POLICY "Agent updates own finance forms" ON public.student_finance_forms FOR UPDATE TO authenticated
  USING (student_id IN (SELECT s.id FROM students s WHERE s.agent_id = auth.uid()));
