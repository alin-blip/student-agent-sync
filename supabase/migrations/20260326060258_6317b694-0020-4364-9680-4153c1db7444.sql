
CREATE TABLE public.timetable_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.timetable_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read timetable options"
  ON public.timetable_options FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owner manages timetable options"
  ON public.timetable_options FOR ALL
  TO public
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
