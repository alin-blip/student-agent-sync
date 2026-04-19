-- B2B Cleanup: Update defaults & migrate legacy data
-- The 'admin' and 'agent' enum values are kept in app_role to avoid mass-dropping ~150 RLS policies.
-- They are functionally dormant (no users hold them, no code references them after this rebrand).

-- Update commission_payments default for new rows
ALTER TABLE public.commission_payments 
  ALTER COLUMN recipient_role SET DEFAULT 'consultant';

-- Migrate any existing commission_payments rows from legacy labels
UPDATE public.commission_payments SET recipient_role = 'branch_manager' WHERE recipient_role = 'admin';
UPDATE public.commission_payments SET recipient_role = 'consultant' WHERE recipient_role = 'agent';