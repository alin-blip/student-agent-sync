
-- Fix the view to use SECURITY INVOKER (default for views, but explicitly set)
DROP VIEW IF EXISTS public.public_agent_profiles;
CREATE VIEW public.public_agent_profiles
WITH (security_invoker = true) AS
SELECT p.id, p.full_name, p.avatar_url, p.slug
FROM profiles p
WHERE p.slug IS NOT NULL
  AND p.id IN (SELECT user_id FROM agent_card_settings WHERE is_public = true);

-- Grant anon SELECT on the view
GRANT SELECT ON public.public_agent_profiles TO anon;
