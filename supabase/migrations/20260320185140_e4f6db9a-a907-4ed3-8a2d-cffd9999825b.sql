-- =============================================
-- EduForYou UK Agent Management Platform Schema
-- =============================================

-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'agent');

-- 2. Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  admin_id UUID REFERENCES public.profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. Helper: get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- 6. Universities
CREATE TABLE public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

-- 7. Campuses
CREATE TABLE public.campuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;

-- 8. Courses
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  study_mode TEXT NOT NULL DEFAULT 'blended',
  level TEXT NOT NULL DEFAULT 'undergraduate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- 9. Intakes
CREATE TABLE public.intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  application_deadline DATE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.intakes ENABLE ROW LEVEL SECURITY;

-- 10. Students
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  immigration_status TEXT,
  qualifications TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 11. Enrollments
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES public.universities(id),
  campus_id UUID REFERENCES public.campuses(id),
  course_id UUID NOT NULL REFERENCES public.courses(id),
  intake_id UUID REFERENCES public.intakes(id),
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','documents_submitted','processing','accepted','enrolled','active','rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- 12. Commission tiers (reference table)
CREATE TABLE public.commission_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL,
  min_students INT NOT NULL DEFAULT 0,
  max_students INT,
  commission_per_student NUMERIC(10,2) NOT NULL DEFAULT 500
);
ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- user_roles: users can read own role; owner can manage all
CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Owner can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- profiles: role-based access
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Owner can read all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner can manage all profiles" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Admin can read assigned agents" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid()
  );
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- universities, campuses, courses, intakes: everyone can read; owner can manage
CREATE POLICY "Anyone can read universities" ON public.universities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner manages universities" ON public.universities FOR ALL USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Anyone can read campuses" ON public.campuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner manages campuses" ON public.campuses FOR ALL USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Anyone can read courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner manages courses" ON public.courses FOR ALL USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Anyone can read intakes" ON public.intakes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner manages intakes" ON public.intakes FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- students: agent sees own, admin sees team, owner sees all
CREATE POLICY "Agent sees own students" ON public.students
  FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "Agent inserts own students" ON public.students
  FOR INSERT WITH CHECK (agent_id = auth.uid());
CREATE POLICY "Agent updates own students" ON public.students
  FOR UPDATE USING (agent_id = auth.uid());
CREATE POLICY "Admin sees team students" ON public.students
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') AND
    agent_id IN (SELECT id FROM public.profiles WHERE admin_id = auth.uid())
  );
CREATE POLICY "Owner sees all students" ON public.students
  FOR SELECT USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manages all students" ON public.students
  FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- enrollments: similar to students
CREATE POLICY "Agent sees own enrollments" ON public.enrollments
  FOR SELECT USING (
    student_id IN (SELECT id FROM public.students WHERE agent_id = auth.uid())
  );
CREATE POLICY "Agent inserts own enrollments" ON public.enrollments
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE agent_id = auth.uid())
  );
CREATE POLICY "Admin sees team enrollments" ON public.enrollments
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') AND
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.profiles p ON s.agent_id = p.id
      WHERE p.admin_id = auth.uid()
    )
  );
CREATE POLICY "Admin updates team enrollments" ON public.enrollments
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') AND
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.profiles p ON s.agent_id = p.id
      WHERE p.admin_id = auth.uid()
    )
  );
CREATE POLICY "Owner sees all enrollments" ON public.enrollments
  FOR SELECT USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manages all enrollments" ON public.enrollments
  FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- commission_tiers: everyone reads, owner manages
CREATE POLICY "Anyone can read commission tiers" ON public.commission_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner manages commission tiers" ON public.commission_tiers FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- =============================================
-- TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- SEED: Default commission tiers
-- =============================================

INSERT INTO public.commission_tiers (tier_name, min_students, max_students, commission_per_student) VALUES
  ('Starter', 0, 5, 500),
  ('Growth', 6, 15, 750),
  ('Gold', 16, 30, 1000),
  ('Platinum', 31, NULL, 1500);