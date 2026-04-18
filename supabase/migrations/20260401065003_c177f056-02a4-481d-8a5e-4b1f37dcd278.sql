
-- Recreate public_agent_profiles as SECURITY INVOKER (default) instead of SECURITY DEFINER
DROP VIEW IF EXISTS public.public_agent_profiles;

CREATE VIEW public.public_agent_profiles WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.full_name,
  p.avatar_url,
  p.slug
FROM profiles p
WHERE p.slug IS NOT NULL
  AND p.id IN (
    SELECT acs.user_id FROM agent_card_settings acs WHERE acs.is_public = true
  );
