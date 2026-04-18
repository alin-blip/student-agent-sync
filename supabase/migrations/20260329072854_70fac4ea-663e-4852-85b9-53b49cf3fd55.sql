
-- Social Posts table
CREATE TABLE public.social_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  target_role TEXT NOT NULL DEFAULT 'all',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Social Post Recipients table
CREATE TABLE public.social_post_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  seen_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_recipients ENABLE ROW LEVEL SECURITY;

-- RLS for social_posts
CREATE POLICY "Owner manages all social posts" ON public.social_posts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'))
  WITH CHECK (has_role(auth.uid(), 'owner'));

CREATE POLICY "Admin manages own social posts" ON public.social_posts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND created_by = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'admin') AND created_by = auth.uid());

CREATE POLICY "Agent reads assigned posts" ON public.social_posts
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT post_id FROM public.social_post_recipients WHERE agent_id = auth.uid())
  );

-- RLS for social_post_recipients
CREATE POLICY "Owner manages all recipients" ON public.social_post_recipients
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'))
  WITH CHECK (has_role(auth.uid(), 'owner'));

CREATE POLICY "Admin manages team recipients" ON public.social_post_recipients
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin') AND (
      post_id IN (SELECT id FROM public.social_posts WHERE created_by = auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin') AND (
      post_id IN (SELECT id FROM public.social_posts WHERE created_by = auth.uid())
    )
  );

CREATE POLICY "Agent reads own recipients" ON public.social_post_recipients
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agent updates own seen_at" ON public.social_post_recipients
  FOR UPDATE TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());
