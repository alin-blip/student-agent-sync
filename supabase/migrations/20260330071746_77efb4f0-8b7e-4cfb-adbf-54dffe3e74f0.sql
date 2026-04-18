ALTER TABLE public.commission_tiers
ADD COLUMN university_id uuid REFERENCES public.universities(id) ON DELETE CASCADE DEFAULT NULL;