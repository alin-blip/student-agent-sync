
-- Admin can insert their own students (agent_id = their uid)
CREATE POLICY "Admin inserts own students"
ON public.students FOR INSERT
TO public
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND agent_id = auth.uid());

-- Admin can insert enrollments for their own students
CREATE POLICY "Admin inserts own enrollments"
ON public.enrollments FOR INSERT
TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND
  student_id IN (SELECT id FROM students WHERE agent_id = auth.uid())
);

-- Admin can also see their own direct students (not just team)
CREATE POLICY "Admin sees own students"
ON public.students FOR SELECT
TO public
USING (has_role(auth.uid(), 'admin'::app_role) AND agent_id = auth.uid());

-- Admin sees own direct enrollments
CREATE POLICY "Admin sees own enrollments"
ON public.enrollments FOR SELECT
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  student_id IN (SELECT id FROM students WHERE agent_id = auth.uid())
);
