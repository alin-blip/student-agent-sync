
-- Add assessment fields to enrollments
ALTER TABLE public.enrollments 
  ADD COLUMN assessment_date date,
  ADD COLUMN assessment_time time;

-- Cancellation approval requests
CREATE TABLE public.cancellation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE CASCADE NOT NULL,
  requested_by uuid NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_cancellation_request_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid cancellation request status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_cancellation_request_status
  BEFORE INSERT OR UPDATE ON public.cancellation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cancellation_request_status();

ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

-- Agent can see and create their own requests
CREATE POLICY "Agent manages own cancellation requests" ON public.cancellation_requests
  FOR ALL TO authenticated
  USING (requested_by = auth.uid())
  WITH CHECK (requested_by = auth.uid());

-- Admin sees team requests
CREATE POLICY "Admin views team cancellation requests" ON public.cancellation_requests
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND requested_by IN (
    SELECT id FROM public.profiles WHERE admin_id = auth.uid()
  ));

-- Admin can update (approve/reject) team requests
CREATE POLICY "Admin updates team cancellation requests" ON public.cancellation_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND requested_by IN (
    SELECT id FROM public.profiles WHERE admin_id = auth.uid()
  ));

-- Owner full access
CREATE POLICY "Owner full access cancellation requests" ON public.cancellation_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));
