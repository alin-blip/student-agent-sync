-- Drop the old restrictive check constraint
ALTER TABLE public.enrollments DROP CONSTRAINT enrollments_status_check;

-- Add updated constraint with ALL valid statuses
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_status_check 
CHECK (status = ANY (ARRAY[
  'applied'::text, 
  'documents_pending'::text,
  'documents_submitted'::text, 
  'processing'::text, 
  'offer_received'::text,
  'accepted'::text, 
  'funding'::text,
  'enrolled'::text, 
  'active'::text, 
  'rejected'::text, 
  'withdrawn'::text
]));