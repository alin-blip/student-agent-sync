CREATE POLICY "Admin updates own enrollments"
ON public.enrollments
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND student_id IN (
    SELECT students.id FROM students WHERE students.agent_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND student_id IN (
    SELECT students.id FROM students WHERE students.agent_id = auth.uid()
  )
);