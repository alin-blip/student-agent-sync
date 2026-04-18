CREATE POLICY "Authenticated can find owner role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (role = 'owner');