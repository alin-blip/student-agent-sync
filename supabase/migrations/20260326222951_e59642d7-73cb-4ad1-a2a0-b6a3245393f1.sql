
-- Create leads table
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  nationality text,
  course_interest text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Anon can insert (public form)
CREATE POLICY "Anon can submit leads" ON public.leads
FOR INSERT TO anon
WITH CHECK (true);

-- Owner reads all
CREATE POLICY "Owner reads all leads" ON public.leads
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

-- Admin reads team leads
CREATE POLICY "Admin reads team leads" ON public.leads
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND (
    agent_id = auth.uid() OR
    agent_id IN (SELECT id FROM profiles WHERE admin_id = auth.uid())
  )
);

-- Agent reads own leads
CREATE POLICY "Agent reads own leads" ON public.leads
FOR SELECT TO authenticated
USING (agent_id = auth.uid());

-- Anon SELECT on universities for public form dropdown
CREATE POLICY "Anon can read universities" ON public.universities
FOR SELECT TO anon
USING (is_active = true);

-- Anon SELECT on courses for public form dropdown
CREATE POLICY "Anon can read courses" ON public.courses
FOR SELECT TO anon
USING (true);
