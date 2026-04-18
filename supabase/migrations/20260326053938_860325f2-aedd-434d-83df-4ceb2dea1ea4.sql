ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS timetable_available boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS timetable_message text;