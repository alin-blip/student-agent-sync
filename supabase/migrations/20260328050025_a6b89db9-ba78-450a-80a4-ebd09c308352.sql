
CREATE TABLE public.course_timetable_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  campus_id uuid REFERENCES public.campuses(id) ON DELETE CASCADE,
  timetable_option_id uuid NOT NULL REFERENCES public.timetable_options(id) ON DELETE CASCADE,
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, campus_id, timetable_option_id)
);

ALTER TABLE public.course_timetable_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read course timetable groups"
  ON public.course_timetable_groups FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Anon can read course timetable groups"
  ON public.course_timetable_groups FOR SELECT TO anon
  USING (true);

CREATE POLICY "Owner manages course timetable groups"
  ON public.course_timetable_groups FOR ALL TO public
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
