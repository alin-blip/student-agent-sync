
CREATE TABLE public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT false
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Owner can read all presence
CREATE POLICY "Owner reads all presence"
ON public.user_presence FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- Admin can read all presence
CREATE POLICY "Admin reads all presence"
ON public.user_presence FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Agents can read presence of conversation partners
CREATE POLICY "Agent reads conversation partner presence"
ON public.user_presence FOR SELECT TO authenticated
USING (
  user_id IN (
    SELECT CASE WHEN dc.participant_1 = auth.uid() THEN dc.participant_2 ELSE dc.participant_1 END
    FROM direct_conversations dc
    WHERE dc.participant_1 = auth.uid() OR dc.participant_2 = auth.uid()
  )
);

-- Users can read own presence
CREATE POLICY "Users read own presence"
ON public.user_presence FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Users can insert own presence
CREATE POLICY "Users insert own presence"
ON public.user_presence FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update own presence
CREATE POLICY "Users update own presence"
ON public.user_presence FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
