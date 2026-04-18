
CREATE TABLE public.ai_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  file_path text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read knowledge base"
  ON public.ai_knowledge_base FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owner manages knowledge base"
  ON public.ai_knowledge_base FOR ALL
  TO public
  USING (has_role(auth.uid(), 'owner'))
  WITH CHECK (has_role(auth.uid(), 'owner'));

CREATE POLICY "Admin inserts knowledge base"
  ON public.ai_knowledge_base FOR INSERT
  TO public
  WITH CHECK (has_role(auth.uid(), 'admin') AND created_by = auth.uid());

CREATE POLICY "Admin deletes own knowledge base"
  ON public.ai_knowledge_base FOR DELETE
  TO public
  USING (has_role(auth.uid(), 'admin') AND created_by = auth.uid());
