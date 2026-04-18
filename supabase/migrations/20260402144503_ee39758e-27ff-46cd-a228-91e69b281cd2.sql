
-- Drop admin team lead policies
DROP POLICY IF EXISTS "Admin reads team leads" ON public.leads;
DROP POLICY IF EXISTS "Admin updates team leads" ON public.leads;

-- Create SECURITY DEFINER function for admin to see lead counts per agent
CREATE OR REPLACE FUNCTION public.get_team_lead_counts(_admin_id uuid)
RETURNS TABLE(agent_id uuid, agent_name text, lead_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    l.agent_id,
    p.full_name::text AS agent_name,
    count(*)::bigint AS lead_count
  FROM public.leads l
  JOIN public.profiles p ON p.id = l.agent_id
  WHERE p.admin_id = _admin_id
  GROUP BY l.agent_id, p.full_name
  ORDER BY lead_count DESC
$$;
