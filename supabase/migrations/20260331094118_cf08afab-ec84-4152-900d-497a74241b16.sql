-- Create consent signing tokens table
CREATE TABLE public.consent_signing_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  signed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.consent_signing_tokens ENABLE ROW LEVEL SECURITY;

-- Service role full access (edge functions use service role)
CREATE POLICY "Service role manages consent tokens"
ON public.consent_signing_tokens FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Anon can read pending tokens (for public signing page)
CREATE POLICY "Anon reads pending consent tokens"
ON public.consent_signing_tokens FOR SELECT
TO anon
USING (status = 'pending' AND expires_at > now());

-- Authenticated users can read tokens for their students
CREATE POLICY "Agent reads own consent tokens"
ON public.consent_signing_tokens FOR SELECT
TO authenticated
USING (agent_id = auth.uid());

CREATE POLICY "Admin reads team consent tokens"
ON public.consent_signing_tokens FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND (
    agent_id = auth.uid() OR
    agent_id IN (SELECT id FROM profiles WHERE admin_id = auth.uid())
  )
);

CREATE POLICY "Owner reads all consent tokens"
ON public.consent_signing_tokens FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- Authenticated users can create tokens for their students
CREATE POLICY "Agent creates consent tokens"
ON public.consent_signing_tokens FOR INSERT
TO authenticated
WITH CHECK (
  agent_id = auth.uid() AND
  student_id IN (SELECT id FROM students WHERE agent_id = auth.uid())
);

CREATE POLICY "Admin creates consent tokens"
ON public.consent_signing_tokens FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND
  agent_id = auth.uid() AND
  student_id IN (SELECT id FROM students WHERE agent_id = auth.uid())
);

CREATE POLICY "Owner creates consent tokens"
ON public.consent_signing_tokens FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role));