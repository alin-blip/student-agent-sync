
-- Add columns to leads for structured course selection
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS university_id uuid,
  ADD COLUMN IF NOT EXISTS campus_id uuid,
  ADD COLUMN IF NOT EXISTS course_id uuid,
  ADD COLUMN IF NOT EXISTS intake_id uuid,
  ADD COLUMN IF NOT EXISTS timetable_option text;

-- Anon SELECT on campuses for public form
CREATE POLICY "Anon can read campuses" ON public.campuses
FOR SELECT TO anon USING (true);

-- Anon SELECT on intakes for public form
CREATE POLICY "Anon can read intakes" ON public.intakes
FOR SELECT TO anon USING (true);

-- Anon SELECT on timetable_options for public form
CREATE POLICY "Anon can read timetable options" ON public.timetable_options
FOR SELECT TO anon USING (true);
