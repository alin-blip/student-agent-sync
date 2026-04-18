
CREATE TABLE public.course_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  personal_statement_guidelines text,
  admission_test_info text,
  interview_info text,
  entry_requirements text,
  documents_required text,
  additional_info text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id)
);

ALTER TABLE public.course_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read course details"
  ON public.course_details FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owner manages course details"
  ON public.course_details FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_course_details_updated_at
  BEFORE UPDATE ON public.course_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
