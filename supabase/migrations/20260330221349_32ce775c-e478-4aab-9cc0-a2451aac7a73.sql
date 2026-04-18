CREATE OR REPLACE VIEW public.public_agent_profiles
WITH (security_invoker = false)
AS
SELECT id, full_name, avatar_url, slug
FROM profiles p
WHERE slug IS NOT NULL
AND id IN (
  SELECT user_id FROM agent_card_settings WHERE is_public = true
);