
-- 1. Allow anon to SELECT profiles (restricted: only active profiles, for RLS subquery)
CREATE POLICY "Anon reads active profile ids"
ON public.profiles
FOR SELECT
TO anon
USING (is_active = true);

-- 2. Unique index on LOWER(email) for students (partial, where email is not null)
CREATE UNIQUE INDEX idx_students_email_unique ON public.students (LOWER(email)) WHERE email IS NOT NULL;
