
CREATE TABLE public.transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  new_university_id uuid NOT NULL REFERENCES public.universities(id),
  new_campus_id uuid REFERENCES public.campuses(id),
  new_course_id uuid NOT NULL REFERENCES public.courses(id),
  new_intake_id uuid REFERENCES public.intakes(id),
  code text NOT NULL DEFAULT substr(upper(encode(extensions.gen_random_bytes(3), 'hex')), 1, 6),
  status text NOT NULL DEFAULT 'pending',
  approver_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);

ALTER TABLE public.transfer_requests ENABLE ROW LEVEL SECURITY;

-- Requester can insert
CREATE POLICY "Requester inserts transfer request"
  ON public.transfer_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

-- Requester reads own requests
CREATE POLICY "Requester reads own transfer requests"
  ON public.transfer_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid());

-- Approver can read requests assigned to them
CREATE POLICY "Approver reads assigned requests"
  ON public.transfer_requests FOR SELECT TO authenticated
  USING (approver_id = auth.uid());

-- Owner full access
CREATE POLICY "Owner manages all transfer requests"
  ON public.transfer_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

-- Service role full access (for edge functions)
CREATE POLICY "Service role manages transfer requests"
  ON public.transfer_requests FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
