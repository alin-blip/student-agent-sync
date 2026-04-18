
-- Issue 1: Allow participants to UPDATE their conversations (fixes sorting)
CREATE POLICY "Participants can update their conversations"
ON public.direct_conversations
FOR UPDATE TO authenticated
USING (auth.uid() IN (participant_1, participant_2))
WITH CHECK (auth.uid() IN (participant_1, participant_2));

-- Issue 3: Agents can see their admin's role
CREATE POLICY "Agent can read admin role"
ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = public.get_my_admin_id());

-- Issue 4: Admins can see roles of their team agents
CREATE POLICY "Admin can read team agent roles"
ON public.user_roles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
      AND p.admin_id = auth.uid()
  )
);
