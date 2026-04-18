
ALTER TABLE public.promotions ADD COLUMN target_role text NOT NULL DEFAULT 'agent';

CREATE POLICY "Admin inserts own promo" ON public.agent_promotions
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND agent_id = auth.uid());
