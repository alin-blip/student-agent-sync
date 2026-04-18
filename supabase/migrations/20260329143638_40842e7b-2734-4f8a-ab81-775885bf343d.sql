-- Security definer function to check if an agent has a recipient record for a post
CREATE OR REPLACE FUNCTION public.is_post_recipient(_user_id uuid, _post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.social_post_recipients
    WHERE agent_id = _user_id AND post_id = _post_id
  )
$$;

-- Security definer function to check if a post was created by a user
CREATE OR REPLACE FUNCTION public.is_post_creator(_user_id uuid, _post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.social_posts
    WHERE created_by = _user_id AND id = _post_id
  )
$$;

-- Drop and recreate the problematic policies
DROP POLICY IF EXISTS "Agent reads assigned posts" ON public.social_posts;
CREATE POLICY "Agent reads assigned posts"
ON public.social_posts
FOR SELECT
TO authenticated
USING (public.is_post_recipient(auth.uid(), id));

-- Fix social_post_recipients policies that reference social_posts
DROP POLICY IF EXISTS "Admin manages team recipients" ON public.social_post_recipients;
CREATE POLICY "Admin manages team recipients"
ON public.social_post_recipients
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND public.is_post_creator(auth.uid(), post_id)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND public.is_post_creator(auth.uid(), post_id)
);