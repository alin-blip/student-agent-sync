
CREATE TABLE public.agent_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  personal_deadline timestamptz NOT NULL,
  UNIQUE(promotion_id, agent_id)
);

ALTER TABLE public.agent_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent reads own promo" ON public.agent_promotions
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agent inserts own promo" ON public.agent_promotions
  FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Owner reads all promos" ON public.agent_promotions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admin reads team promos" ON public.agent_promotions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND (
    agent_id = auth.uid() OR agent_id IN (
      SELECT id FROM profiles WHERE admin_id = auth.uid()
    )
  ));
