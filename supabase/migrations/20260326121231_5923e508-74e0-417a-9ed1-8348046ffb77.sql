-- 1. Add resolved_at to student_notes
ALTER TABLE public.student_notes ADD COLUMN resolved_at timestamptz DEFAULT NULL;

-- 2. Direct conversations table
CREATE TABLE public.direct_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2 uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(participant_1, participant_2)
);

ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages all conversations" ON public.direct_conversations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Users see own conversations" ON public.direct_conversations
  FOR SELECT TO authenticated
  USING (participant_1 = auth.uid() OR participant_2 = auth.uid());

CREATE POLICY "Users create own conversations" ON public.direct_conversations
  FOR INSERT TO authenticated
  WITH CHECK (participant_1 = auth.uid() OR participant_2 = auth.uid());

-- 3. Direct messages table
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages all messages" ON public.direct_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Users see own conversation messages" ON public.direct_messages
  FOR SELECT TO authenticated
  USING (conversation_id IN (
    SELECT id FROM public.direct_conversations
    WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
  ));

CREATE POLICY "Users send own conversation messages" ON public.direct_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT id FROM public.direct_conversations
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

CREATE POLICY "Users update own conversation messages" ON public.direct_messages
  FOR UPDATE TO authenticated
  USING (conversation_id IN (
    SELECT id FROM public.direct_conversations
    WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

CREATE TRIGGER update_direct_conversations_updated_at
  BEFORE UPDATE ON public.direct_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();