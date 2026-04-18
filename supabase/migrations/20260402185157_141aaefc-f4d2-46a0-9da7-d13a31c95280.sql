
-- Step 1: Drop the recursive policy that broke profiles
DROP POLICY IF EXISTS "Agent reads own admin profile" ON public.profiles;

-- Step 2: Create a SECURITY DEFINER function to safely get current user's admin_id
CREATE OR REPLACE FUNCTION public.get_my_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT admin_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_admin_id FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_admin_id TO authenticated;

-- Step 3: Recreate the policy using the safe function
CREATE POLICY "Agent reads own admin profile"
ON public.profiles
FOR SELECT TO authenticated
USING (id = public.get_my_admin_id());
