ALTER TABLE public.student_documents
ADD COLUMN cancelled_at timestamptz DEFAULT NULL,
ADD COLUMN cancelled_by uuid DEFAULT NULL;