
-- Add tuition fee percentage to courses (owner sets what % of fees they receive per course)
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS tuition_fee_percentage numeric DEFAULT NULL;

-- Add override fields to commission_snapshots (owner can override rate per student)
ALTER TABLE public.commission_snapshots ADD COLUMN IF NOT EXISTS override_amount numeric DEFAULT NULL;
ALTER TABLE public.commission_snapshots ADD COLUMN IF NOT EXISTS override_percentage numeric DEFAULT NULL;

-- The effective rate becomes: COALESCE(override_amount, agent_rate)
-- override_percentage stores the custom % used if owner changed it for this student
