ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS full_address text,
  ADD COLUMN IF NOT EXISTS uk_entry_date date,
  ADD COLUMN IF NOT EXISTS share_code text,
  ADD COLUMN IF NOT EXISTS ni_number text,
  ADD COLUMN IF NOT EXISTS previous_funding_years integer,
  ADD COLUMN IF NOT EXISTS study_pattern text,
  ADD COLUMN IF NOT EXISTS next_of_kin_name text,
  ADD COLUMN IF NOT EXISTS next_of_kin_phone text,
  ADD COLUMN IF NOT EXISTS next_of_kin_relationship text;