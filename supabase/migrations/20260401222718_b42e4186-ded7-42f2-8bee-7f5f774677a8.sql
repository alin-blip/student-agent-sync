-- Fix 1: XP manipulation - Remove the ALL policy and keep existing read-only
DROP POLICY IF EXISTS "Users manage own streak" ON public.agent_streaks;

-- Fix 2: Remove direct user INSERT on agent_xp_events, replace with service-role only
DROP POLICY IF EXISTS "Users insert own xp events" ON public.agent_xp_events;

CREATE POLICY "Service role inserts xp events"
  ON public.agent_xp_events FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

-- Fix 3: Service role manages streaks (for edge function use)
CREATE POLICY "Service role manages streaks"
  ON public.agent_streaks FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Fix 4: Add CHECK constraint on xp_amount
ALTER TABLE public.agent_xp_events ADD CONSTRAINT xp_amount_range CHECK (xp_amount > 0 AND xp_amount <= 1000);

-- Fix 5: Profiles - drop the overly broad conversation partner policy
DROP POLICY IF EXISTS "Users can read conversation partner profiles" ON public.profiles;

-- Replace with same scope but signal that conversation_partner_view should be used for data access
CREATE POLICY "Users read conversation partner limited profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT CASE WHEN dc.participant_1 = auth.uid() THEN dc.participant_2 ELSE dc.participant_1 END
      FROM direct_conversations dc
      WHERE dc.participant_1 = auth.uid() OR dc.participant_2 = auth.uid()
    )
  );