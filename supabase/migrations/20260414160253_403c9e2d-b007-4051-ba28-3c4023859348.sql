
CREATE TABLE public.image_generation_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  preset TEXT NOT NULL DEFAULT 'social_post',
  status TEXT NOT NULL DEFAULT 'queued',
  result_url TEXT,
  error_message TEXT,
  remaining INTEGER,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.image_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs"
ON public.image_generation_jobs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_image_generation_jobs_user_status ON public.image_generation_jobs (user_id, status);
