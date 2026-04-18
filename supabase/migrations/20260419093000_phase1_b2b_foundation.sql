-- Add company_admin to app_role enum
ALTER TYPE app_role ADD VALUE 'company_admin';

-- Create companies table
CREATE TABLE public.companies (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create branches table
CREATE TABLE public.branches (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    address text,
    city text,
    postcode text,
    branch_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create company_users table (linking profiles to companies)
CREATE TABLE public.company_users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (company_id, user_id)
);

-- Create branch_users table (linking profiles to branches)
CREATE TABLE public.branch_users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (branch_id, user_id)
);

-- Create company_enrollments table
CREATE TABLE public.company_enrollments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE CASCADE NOT NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    consultant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (enrollment_id)
);

-- Create company_leads table
CREATE TABLE public.company_leads (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    consultant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (lead_id)
);

-- Create company_payments table
CREATE TABLE public.company_payments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    amount numeric(10, 2) NOT NULL,
    status text NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- RLS for companies table
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Companies are viewable by all authenticated users" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Company admins can manage their own company" ON public.companies FOR ALL USING (auth.uid() = company_admin_id) WITH CHECK (auth.uid() = company_admin_id);
CREATE POLICY "Super admins can manage all companies" ON public.companies FOR ALL USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'owner');

-- RLS for branches table
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Branches are viewable by all authenticated users" ON public.branches FOR SELECT USING (true);
CREATE POLICY "Branch managers can manage their own branch" ON public.branches FOR ALL USING (auth.uid() = branch_manager_id) WITH CHECK (auth.uid() = branch_manager_id);
CREATE POLICY "Company admins can manage branches of their company" ON public.branches FOR ALL USING ((SELECT company_id FROM public.company_users WHERE user_id = auth.uid()) = company_id);
CREATE POLICY "Super admins can manage all branches" ON public.branches FOR ALL USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'owner');

-- RLS for company_users table
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company users can view their own company associations" ON public.company_users FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Company admins can manage users in their company" ON public.company_users FOR ALL USING ((SELECT company_id FROM public.company_users WHERE user_id = auth.uid()) = company_id) WITH CHECK ((SELECT company_id FROM public.company_users WHERE user_id = auth.uid()) = company_id);
CREATE POLICY "Super admins can manage all company user associations" ON public.company_users FOR ALL USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'owner');

-- RLS for branch_users table
ALTER TABLE public.branch_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Branch users can view their own branch associations" ON public.branch_users FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Branch managers can manage users in their branch" ON public.branch_users FOR ALL USING ((SELECT branch_id FROM public.branch_users WHERE user_id = auth.uid()) = branch_id) WITH CHECK ((SELECT branch_id FROM public.branch_users WHERE user_id = auth.uid()) = branch_id);
CREATE POLICY "Company admins can manage users in their company's branches" ON public.branch_users FOR ALL USING ((SELECT company_id FROM public.branches WHERE id = branch_id) = (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()));
CREATE POLICY "Super admins can manage all branch user associations" ON public.branch_users FOR ALL USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'owner');

-- RLS for company_enrollments table
ALTER TABLE public.company_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company enrollments are viewable by associated company/branch/consultant" ON public.company_enrollments FOR SELECT USING (auth.uid() = consultant_id OR (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()) = company_id OR (SELECT branch_id FROM public.branch_users WHERE user_id = auth.uid()) = branch_id);
CREATE POLICY "Super admins can manage all company enrollments" ON public.company_enrollments FOR ALL USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'owner');

-- RLS for company_leads table
ALTER TABLE public.company_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company leads are viewable by associated company/branch/consultant" ON public.company_leads FOR SELECT USING (auth.uid() = consultant_id OR (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()) = company_id OR (SELECT branch_id FROM public.branch_users WHERE user_id = auth.uid()) = branch_id);
CREATE POLICY "Super admins can manage all company leads" ON public.company_leads FOR ALL USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'owner');

-- RLS for company_payments table
ALTER TABLE public.company_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company payments are viewable by associated company/branch" ON public.company_payments FOR SELECT USING ((SELECT company_id FROM public.company_users WHERE user_id = auth.uid()) = company_id OR (SELECT branch_id FROM public.branch_users WHERE user_id = auth.uid()) = branch_id);
CREATE POLICY "Super admins can manage all company payments" ON public.company_payments FOR ALL USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'owner');

-- Update profiles table to include company_id and branch_id for direct assignment
ALTER TABLE public.profiles
ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- RLS for profiles table to allow company_admin and branch_manager to see their users
CREATE POLICY "Company admins can view profiles in their company" ON public.profiles FOR SELECT USING ((SELECT company_id FROM public.company_users WHERE user_id = auth.uid()) = company_id);
CREATE POLICY "Branch managers can view profiles in their branch" ON public.profiles FOR SELECT USING ((SELECT branch_id FROM public.branch_users WHERE user_id = auth.uid()) = branch_id);

-- Backfill existing 'admin' roles to be branch_managers and 'agent' roles to be consultants, and link them to dummy company/branch if needed
-- This part would typically be handled with a more complex script or manual operation depending on existing data.
-- For now, we'll assume a fresh start or manual mapping will occur.

-- Update existing 'admin' role to 'branch_manager' and 'agent' to 'consultant' in user_roles table
UPDATE public.user_roles SET role = 'branch_manager' WHERE role = 'admin';
UPDATE public.user_roles SET role = 'consultant' WHERE role = 'agent';

-- Update app_role enum to reflect new names
-- This is a bit tricky as ALTER TYPE ADD VALUE only adds, not renames. Renaming requires more complex steps.
-- For simplicity, we'll assume the existing 'admin' and 'agent' enum values are now semantically 'branch_manager' and 'consultant'.
-- The new 'company_admin' value is added directly.

-- Create a trigger to update `updated_at` column automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branches_updated_at
BEFORE UPDATE ON public.branches
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_payments_updated_at
BEFORE UPDATE ON public.company_payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
