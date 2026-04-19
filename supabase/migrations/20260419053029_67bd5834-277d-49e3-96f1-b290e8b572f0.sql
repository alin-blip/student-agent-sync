-- Cleanup
DROP TABLE IF EXISTS public.user_passwords CASCADE;

-- =========================================================
-- Tables
-- =========================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_type text,
  logo_url text,
  contact_email text,
  contact_phone text,
  address text,
  city text,
  postcode text,
  contract_terms text,
  contract_start date,
  contract_end date,
  company_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE,
  address text,
  city text,
  postcode text,
  contact_person text,
  contact_email text,
  contact_phone text,
  branch_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.branch_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.company_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL UNIQUE REFERENCES public.enrollments(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  consultant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  consultant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.widget_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid UNIQUE REFERENCES public.branches(id) ON DELETE CASCADE,
  allowed_domains text[] NOT NULL DEFAULT ARRAY[]::text[],
  header_color text NOT NULL DEFAULT '#0A1628',
  button_color text NOT NULL DEFAULT '#D4AF37',
  text_color text NOT NULL DEFAULT '#FFFFFF',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.widget_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  consultant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text,
  status text NOT NULL DEFAULT 'new',
  origin_domain text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company_type text,
  city text,
  num_locations integer,
  num_employees text,
  network_access text[],
  network_size text,
  motivation text,
  how_heard text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','approved','rejected')),
  notes text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.generated_email_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  university_id uuid REFERENCES public.universities(id) ON DELETE SET NULL,
  campus_id uuid REFERENCES public.campuses(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  audience text,
  tone text,
  email_count integer,
  emails_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- profiles columns + indexes
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON public.profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_branches_company_id ON public.branches(company_id);
CREATE INDEX IF NOT EXISTS idx_branches_slug ON public.branches(slug);

-- =========================================================
-- SECURITY DEFINER helpers (avoid RLS recursion)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.get_my_branch_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT branch_id FROM public.profiles WHERE id = auth.uid() LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.is_company_admin_of(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = auth.uid()
      AND ur.role = 'company_admin'
      AND p.company_id = _company_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_branch_manager_of(_branch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = auth.uid()
      AND ur.role = 'branch_manager'
      AND p.branch_id = _branch_id
  )
$$;

-- =========================================================
-- Enable RLS + policies
-- =========================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_email_sequences ENABLE ROW LEVEL SECURITY;

-- companies
CREATE POLICY "Owner manages companies" ON public.companies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Authenticated reads companies" ON public.companies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Company admin updates own company" ON public.companies
  FOR UPDATE TO authenticated
  USING (id = public.get_my_company_id())
  WITH CHECK (id = public.get_my_company_id());

-- branches
CREATE POLICY "Owner manages branches" ON public.branches
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Authenticated reads branches" ON public.branches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Company admin manages own branches" ON public.branches
  FOR ALL TO authenticated
  USING (company_id = public.get_my_company_id() AND public.has_role(auth.uid(), 'company_admin'))
  WITH CHECK (company_id = public.get_my_company_id() AND public.has_role(auth.uid(), 'company_admin'));
CREATE POLICY "Branch manager updates own branch" ON public.branches
  FOR UPDATE TO authenticated
  USING (id = public.get_my_branch_id())
  WITH CHECK (id = public.get_my_branch_id());

-- company_users
CREATE POLICY "Owner manages company_users" ON public.company_users
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Users read own company_users" ON public.company_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Company admin reads own company_users" ON public.company_users
  FOR SELECT TO authenticated USING (company_id = public.get_my_company_id());

-- branch_users
CREATE POLICY "Owner manages branch_users" ON public.branch_users
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Users read own branch_users" ON public.branch_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Branch manager reads own branch_users" ON public.branch_users
  FOR SELECT TO authenticated USING (branch_id = public.get_my_branch_id());
CREATE POLICY "Company admin reads company branch_users" ON public.branch_users
  FOR SELECT TO authenticated
  USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_my_company_id()));

-- company_enrollments
CREATE POLICY "Owner manages company_enrollments" ON public.company_enrollments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Consultant reads own company_enrollments" ON public.company_enrollments
  FOR SELECT TO authenticated USING (consultant_id = auth.uid());
CREATE POLICY "Branch manager reads branch company_enrollments" ON public.company_enrollments
  FOR SELECT TO authenticated USING (branch_id = public.get_my_branch_id());
CREATE POLICY "Company admin reads company company_enrollments" ON public.company_enrollments
  FOR SELECT TO authenticated USING (company_id = public.get_my_company_id());

-- company_leads
CREATE POLICY "Owner manages company_leads" ON public.company_leads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Consultant reads own company_leads" ON public.company_leads
  FOR SELECT TO authenticated USING (consultant_id = auth.uid());
CREATE POLICY "Branch manager reads branch company_leads" ON public.company_leads
  FOR SELECT TO authenticated USING (branch_id = public.get_my_branch_id());
CREATE POLICY "Company admin reads company company_leads" ON public.company_leads
  FOR SELECT TO authenticated USING (company_id = public.get_my_company_id());

-- company_payments
CREATE POLICY "Owner manages company_payments" ON public.company_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Branch manager reads branch payments" ON public.company_payments
  FOR SELECT TO authenticated USING (branch_id = public.get_my_branch_id());
CREATE POLICY "Company admin reads company payments" ON public.company_payments
  FOR SELECT TO authenticated USING (company_id = public.get_my_company_id());

-- widget_settings
CREATE POLICY "Owner manages widget_settings" ON public.widget_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Public reads widget_settings" ON public.widget_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Branch manager manages own widget_settings" ON public.widget_settings
  FOR ALL TO authenticated
  USING (branch_id = public.get_my_branch_id())
  WITH CHECK (branch_id = public.get_my_branch_id());
CREATE POLICY "Company admin manages company widget_settings" ON public.widget_settings
  FOR ALL TO authenticated
  USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_my_company_id()))
  WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_my_company_id()));

-- widget_leads
CREATE POLICY "Owner manages widget_leads" ON public.widget_leads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Public submits widget_leads" ON public.widget_leads
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Consultant reads assigned widget_leads" ON public.widget_leads
  FOR SELECT TO authenticated USING (consultant_id = auth.uid());
CREATE POLICY "Branch manager reads branch widget_leads" ON public.widget_leads
  FOR SELECT TO authenticated USING (branch_id = public.get_my_branch_id());
CREATE POLICY "Company admin reads company widget_leads" ON public.widget_leads
  FOR SELECT TO authenticated
  USING (branch_id IN (SELECT id FROM public.branches WHERE company_id = public.get_my_company_id()));

-- company_applications
CREATE POLICY "Owner manages company_applications" ON public.company_applications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Public submits company_applications" ON public.company_applications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- generated_email_sequences
CREATE POLICY "Owner reads all generated_email_sequences" ON public.generated_email_sequences
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Users manage own generated_email_sequences" ON public.generated_email_sequences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Branch manager reads branch generated_email_sequences" ON public.generated_email_sequences
  FOR SELECT TO authenticated USING (branch_id = public.get_my_branch_id());
CREATE POLICY "Company admin reads company generated_email_sequences" ON public.generated_email_sequences
  FOR SELECT TO authenticated USING (company_id = public.get_my_company_id());

-- Profiles: extra read access for company_admin / branch_manager
CREATE POLICY "Company admin reads company profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (company_id IS NOT NULL AND company_id = public.get_my_company_id());
CREATE POLICY "Branch manager reads branch profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (branch_id IS NOT NULL AND branch_id = public.get_my_branch_id());

-- =========================================================
-- updated_at triggers
-- =========================================================
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER branches_updated_at BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER company_payments_updated_at BEFORE UPDATE ON public.company_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER widget_settings_updated_at BEFORE UPDATE ON public.widget_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER company_applications_updated_at BEFORE UPDATE ON public.company_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();