-- Create table for student document upload requests
CREATE TABLE public.student_document_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  requested_doc_types text[] NOT NULL DEFAULT '{}',
  message text,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '14 days'),
  submitted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_sdr_token ON public.student_document_requests(token);
CREATE INDEX idx_sdr_student ON public.student_document_requests(student_id);
CREATE INDEX idx_sdr_agent ON public.student_document_requests(agent_id);

ALTER TABLE public.student_document_requests ENABLE ROW LEVEL SECURITY;

-- Agent can create and read own requests
CREATE POLICY "Agent creates own document requests"
ON public.student_document_requests FOR INSERT TO authenticated
WITH CHECK (
  agent_id = auth.uid()
  AND student_id IN (SELECT id FROM public.students WHERE agent_id = auth.uid())
);

CREATE POLICY "Agent reads own document requests"
ON public.student_document_requests FOR SELECT TO authenticated
USING (agent_id = auth.uid());

-- Admin reads team requests
CREATE POLICY "Admin reads team document requests"
ON public.student_document_requests FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND (
    agent_id = auth.uid()
    OR agent_id IN (SELECT id FROM public.profiles WHERE admin_id = auth.uid())
  )
);

CREATE POLICY "Admin creates document requests for team"
ON public.student_document_requests FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND agent_id = auth.uid()
);

-- Owner full access
CREATE POLICY "Owner manages all document requests"
ON public.student_document_requests FOR ALL TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

-- Service role full access (for public validation/submission edge functions)
CREATE POLICY "Service role manages document requests"
ON public.student_document_requests FOR ALL TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');