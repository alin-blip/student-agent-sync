
CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  category TEXT NOT NULL DEFAULT 'suggestion',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own feedback"
  ON public.feedback FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owner reads all feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owner updates all feedback"
  ON public.feedback FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
