ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS timetable text;