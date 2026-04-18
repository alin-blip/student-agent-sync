
-- Add UPDATE policy for owner on leads (already has ALL, but let's add for admin/agent too)
CREATE POLICY "Admin updates team leads" ON public.leads
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND (
    agent_id = auth.uid() OR
    agent_id IN (SELECT id FROM profiles WHERE admin_id = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND (
    agent_id = auth.uid() OR
    agent_id IN (SELECT id FROM profiles WHERE admin_id = auth.uid())
  )
);

CREATE POLICY "Agent updates own leads" ON public.leads
FOR UPDATE TO authenticated
USING (agent_id = auth.uid())
WITH CHECK (agent_id = auth.uid());
