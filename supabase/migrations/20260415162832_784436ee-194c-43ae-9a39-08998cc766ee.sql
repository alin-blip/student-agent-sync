
CREATE TABLE public.user_passwords (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  password_plaintext text NOT NULL,
  set_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_passwords ENABLE ROW LEVEL SECURITY;

-- Owner can see all passwords
CREATE POLICY "Owner reads all passwords"
ON public.user_passwords
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Admin can see passwords only for their own agents
CREATE POLICY "Admin reads team passwords"
ON public.user_passwords
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') AND
  user_id IN (
    SELECT id FROM public.profiles WHERE admin_id = auth.uid()
  )
);

-- Only service_role can insert/update (via edge functions)
CREATE POLICY "Service role manages passwords"
ON public.user_passwords
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Trigger to auto-update updated_at
CREATE TRIGGER update_user_passwords_updated_at
BEFORE UPDATE ON public.user_passwords
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
