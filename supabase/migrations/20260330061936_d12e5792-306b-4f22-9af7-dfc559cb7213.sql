
CREATE TABLE public.university_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  commission_per_student numeric NOT NULL DEFAULT 500,
  label text DEFAULT '',
  is_highlighted boolean NOT NULL DEFAULT false,
  highlight_text text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_id)
);

ALTER TABLE public.university_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages university commissions"
  ON public.university_commissions FOR ALL
  TO public
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Authenticated can read university commissions"
  ON public.university_commissions FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_university_commissions_updated_at
  BEFORE UPDATE ON public.university_commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
