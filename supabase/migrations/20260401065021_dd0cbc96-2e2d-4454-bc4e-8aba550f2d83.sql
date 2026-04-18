
-- Create restricted view for conversation partners (only safe fields)
CREATE VIEW public.conversation_partner_view WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.full_name,
  p.avatar_url,
  p.slug
FROM profiles p;

-- Replace the current overly-permissive conversation partner policy
DROP POLICY IF EXISTS "Users can read conversation partner profiles" ON public.profiles;

-- New policy: conversation partners can only see id, full_name, avatar_url, slug
-- Since RLS works at row level (not column level), we keep the row-level check
-- but the application code should use the conversation_partner_view instead
CREATE POLICY "Users can read conversation partner profiles" ON public.profiles FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT CASE
        WHEN dc.participant_1 = auth.uid() THEN dc.participant_2
        ELSE dc.participant_1
      END
      FROM direct_conversations dc
      WHERE dc.participant_1 = auth.uid() OR dc.participant_2 = auth.uid()
    )
  );
