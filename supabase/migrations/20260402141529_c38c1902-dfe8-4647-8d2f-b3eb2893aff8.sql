
-- Allow conversation participants to mark received messages as read
CREATE POLICY "Recipients can mark messages read"
ON public.direct_messages
FOR UPDATE
USING (
  conversation_id IN (
    SELECT id FROM direct_conversations
    WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
  )
)
WITH CHECK (
  conversation_id IN (
    SELECT id FROM direct_conversations
    WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
  )
);
