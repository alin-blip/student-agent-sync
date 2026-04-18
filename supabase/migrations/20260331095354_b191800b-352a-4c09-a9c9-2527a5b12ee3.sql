-- Allow authenticated users to read profiles of people they have conversations with
CREATE POLICY "Users can read conversation partner profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT CASE WHEN participant_1 = auth.uid() THEN participant_2 ELSE participant_1 END
    FROM direct_conversations
    WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
  )
);