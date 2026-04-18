
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  deadline timestamptz NOT NULL,
  bonus_amount numeric NOT NULL DEFAULT 500,
  bonus_percentage numeric DEFAULT 25,
  target_students integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages promotions" ON public.promotions
  FOR ALL TO public
  USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Authenticated can read active promotions" ON public.promotions
  FOR SELECT TO authenticated
  USING (is_active = true);
