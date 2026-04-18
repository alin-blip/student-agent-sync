
-- Agent XP events log
CREATE TABLE public.agent_xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'daily_login',
  xp_amount integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Agent streaks summary (one row per agent)
CREATE TABLE public.agent_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_active_date date DEFAULT NULL,
  total_xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.agent_xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_streaks ENABLE ROW LEVEL SECURITY;

-- XP events policies
CREATE POLICY "Users read own xp events" ON public.agent_xp_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own xp events" ON public.agent_xp_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner reads all xp events" ON public.agent_xp_events FOR SELECT TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Streaks policies
CREATE POLICY "Users read own streak" ON public.agent_streaks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users manage own streak" ON public.agent_streaks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner reads all streaks" ON public.agent_streaks FOR SELECT TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Authenticated reads all streaks for leaderboard" ON public.agent_streaks FOR SELECT TO authenticated USING (true);
