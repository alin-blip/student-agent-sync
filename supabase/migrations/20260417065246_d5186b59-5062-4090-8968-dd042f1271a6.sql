-- ============ TABLES ============

CREATE TABLE public.learn_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  icon text DEFAULT 'BookOpen',
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.learn_lessons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id uuid NOT NULL REFERENCES public.learn_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  video_url text,
  video_duration integer,
  thumbnail_url text,
  attachments jsonb DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.learn_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.learn_lessons(id) ON DELETE CASCADE,
  completed_at timestamp with time zone,
  watched_seconds integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_learn_lessons_module ON public.learn_lessons(module_id, sort_order);
CREATE INDEX idx_learn_progress_user ON public.learn_progress(user_id);

-- ============ RLS ============

ALTER TABLE public.learn_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learn_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learn_progress ENABLE ROW LEVEL SECURITY;

-- Modules
CREATE POLICY "Anyone authenticated reads published modules"
ON public.learn_modules FOR SELECT TO authenticated
USING (is_published = true OR has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner and admin manage modules"
ON public.learn_modules FOR ALL TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Lessons
CREATE POLICY "Anyone authenticated reads published lessons"
ON public.learn_lessons FOR SELECT TO authenticated
USING (is_published = true OR has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner and admin manage lessons"
ON public.learn_lessons FOR ALL TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Progress
CREATE POLICY "Users manage own progress"
ON public.learn_progress FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner reads all progress"
ON public.learn_progress FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- Triggers for updated_at
CREATE TRIGGER trg_learn_modules_updated
BEFORE UPDATE ON public.learn_modules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_learn_lessons_updated
BEFORE UPDATE ON public.learn_lessons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_learn_progress_updated
BEFORE UPDATE ON public.learn_progress
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SEED MODULES ============

INSERT INTO public.learn_modules (title, description, icon, sort_order) VALUES
  ('Start Here — Setup & Commissions', 'Optimize your platform profile and understand how commissions work.', 'Rocket', 0),
  ('Module 1 — Master the Process', 'Enrollment process, funding, requirements, admission test, and university-specific videos.', 'GraduationCap', 1),
  ('Module 2 — Admission Test Prep', 'Prepare for the admission test using the admission.eduforyou.co.uk platform.', 'BookOpen', 2),
  ('Module 3 — Marketing & First Client', 'Get your first client through social media, content, and AI video.', 'Megaphone', 3),
  ('7-Day Live Challenge', 'Live sessions and replays — accelerate results in one week.', 'Flame', 4);

-- ============ STORAGE ============

INSERT INTO storage.buckets (id, name, public)
VALUES ('learn-videos', 'learn-videos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public reads learn videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'learn-videos');

CREATE POLICY "Owner and admin upload learn videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'learn-videos' AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Owner and admin update learn videos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'learn-videos' AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Owner and admin delete learn videos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'learn-videos' AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));