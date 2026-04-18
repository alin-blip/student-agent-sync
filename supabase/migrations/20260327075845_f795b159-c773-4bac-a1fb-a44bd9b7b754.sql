CREATE POLICY "Owner reads all email logs"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role));