-- Lesson comments table
CREATE TABLE public.learn_lesson_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.learn_lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  parent_comment_id uuid REFERENCES public.learn_lesson_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_learn_lesson_comments_lesson ON public.learn_lesson_comments(lesson_id, created_at DESC);
CREATE INDEX idx_learn_lesson_comments_parent ON public.learn_lesson_comments(parent_comment_id);

ALTER TABLE public.learn_lesson_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read all lesson comments"
  ON public.learn_lesson_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users insert own comments"
  ON public.learn_lesson_comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own comments"
  ON public.learn_lesson_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own comments"
  ON public.learn_lesson_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owner deletes any comment"
  ON public.learn_lesson_comments FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admin deletes any comment"
  ON public.learn_lesson_comments FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_learn_lesson_comments_updated_at
  BEFORE UPDATE ON public.learn_lesson_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comment reactions table
CREATE TABLE public.learn_comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.learn_lesson_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, emoji)
);

CREATE INDEX idx_learn_comment_reactions_comment ON public.learn_comment_reactions(comment_id);

ALTER TABLE public.learn_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read reactions"
  ON public.learn_comment_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users insert own reactions"
  ON public.learn_comment_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own reactions"
  ON public.learn_comment_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.learn_lesson_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.learn_comment_reactions;