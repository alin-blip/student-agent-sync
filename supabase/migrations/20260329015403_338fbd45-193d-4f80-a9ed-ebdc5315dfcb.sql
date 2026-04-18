
-- 1. Fix DM update policy: restrict to sender_id = auth.uid()
DROP POLICY IF EXISTS "Users update own conversation messages" ON direct_messages;
CREATE POLICY "Users update own conversation messages"
  ON direct_messages FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT id FROM direct_conversations
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT id FROM direct_conversations
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

-- 2. Fix profiles public exposure: create a view with only public-safe columns
CREATE OR REPLACE VIEW public.public_agent_profiles AS
SELECT p.id, p.full_name, p.avatar_url, p.slug
FROM profiles p
WHERE p.slug IS NOT NULL
  AND p.id IN (SELECT user_id FROM agent_card_settings WHERE is_public = true);

-- Drop the old anon policy that exposes full profile rows
DROP POLICY IF EXISTS "Anon can read public card profiles" ON profiles;

-- 3. Tighten leads anon insert policy
DROP POLICY IF EXISTS "Anon can submit leads" ON leads;
CREATE POLICY "Anon can submit leads"
  ON leads FOR INSERT
  TO anon
  WITH CHECK (
    agent_id IN (SELECT id FROM profiles WHERE is_active = true)
  );

-- 4. Fix user_roles owner policy: change from public to authenticated
DROP POLICY IF EXISTS "Owner can manage all roles" ON user_roles;
CREATE POLICY "Owner can manage all roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
