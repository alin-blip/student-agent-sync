CREATE POLICY "Agent reads own admin profile" ON public.profiles
FOR SELECT TO authenticated
USING (id = (SELECT p.admin_id FROM public.profiles p WHERE p.id = auth.uid()));