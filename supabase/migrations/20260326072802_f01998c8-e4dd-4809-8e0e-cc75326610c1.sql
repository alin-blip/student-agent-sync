
-- Add slug column to profiles for public URLs
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Create agent_card_settings table
CREATE TABLE public.agent_card_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  job_title text DEFAULT '',
  whatsapp text DEFAULT '',
  booking_url text DEFAULT '',
  apply_url text DEFAULT '',
  bio text DEFAULT '',
  company_name text DEFAULT 'EduForYou UK',
  company_description text DEFAULT '',
  working_hours text DEFAULT 'Mon-Fri 9:00-17:00',
  accreditation text DEFAULT '',
  social_google text DEFAULT '',
  social_trustpilot text DEFAULT '',
  social_instagram text DEFAULT '',
  social_youtube text DEFAULT '',
  social_facebook text DEFAULT '',
  social_linkedin text DEFAULT '',
  social_tiktok text DEFAULT '',
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_card_settings ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own card settings
CREATE POLICY "Users manage own card settings"
  ON public.agent_card_settings FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Owner can read all card settings
CREATE POLICY "Owner reads all card settings"
  ON public.agent_card_settings FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));

-- Public can read published cards (for /card/:slug route)
CREATE POLICY "Public reads published cards"
  ON public.agent_card_settings FOR SELECT
  TO anon
  USING (is_public = true);

-- Also allow authenticated to read published cards
CREATE POLICY "Authenticated reads published cards"
  ON public.agent_card_settings FOR SELECT
  TO authenticated
  USING (is_public = true);

-- Allow public/anon to read profiles for public card pages
CREATE POLICY "Anon can read public card profiles"
  ON public.profiles FOR SELECT
  TO anon
  USING (
    slug IS NOT NULL AND id IN (
      SELECT user_id FROM public.agent_card_settings WHERE is_public = true
    )
  );
