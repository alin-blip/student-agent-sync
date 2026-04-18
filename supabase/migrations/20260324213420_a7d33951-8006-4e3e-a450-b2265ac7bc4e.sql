
-- Table: ai_conversations
CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- Users CRUD own conversations
CREATE POLICY "Users manage own conversations" ON public.ai_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin reads team conversations
CREATE POLICY "Admin reads team conversations" ON public.ai_conversations
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') AND (
      user_id = auth.uid() OR
      user_id IN (SELECT id FROM public.profiles WHERE admin_id = auth.uid())
    )
  );

-- Owner reads all conversations
CREATE POLICY "Owner reads all conversations" ON public.ai_conversations
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'));

-- Table: ai_messages
CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- Users manage own conversation messages
CREATE POLICY "Users manage own messages" ON public.ai_messages
  FOR ALL TO authenticated
  USING (
    conversation_id IN (SELECT id FROM public.ai_conversations WHERE user_id = auth.uid())
  )
  WITH CHECK (
    conversation_id IN (SELECT id FROM public.ai_conversations WHERE user_id = auth.uid())
  );

-- Admin reads team messages
CREATE POLICY "Admin reads team messages" ON public.ai_messages
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') AND
    conversation_id IN (
      SELECT id FROM public.ai_conversations WHERE user_id = auth.uid() OR user_id IN (SELECT p.id FROM public.profiles p WHERE p.admin_id = auth.uid())
    )
  );

-- Owner reads all messages
CREATE POLICY "Owner reads all messages" ON public.ai_messages
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'));

-- Trigger for updated_at on ai_conversations
CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
