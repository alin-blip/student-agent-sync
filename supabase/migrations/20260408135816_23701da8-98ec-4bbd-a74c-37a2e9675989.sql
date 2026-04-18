-- Admin can update students belonging to their team agents
CREATE POLICY "Admin updates team students" ON public.students
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND agent_id IN (SELECT id FROM public.profiles WHERE admin_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND agent_id IN (SELECT id FROM public.profiles WHERE admin_id = auth.uid())
);