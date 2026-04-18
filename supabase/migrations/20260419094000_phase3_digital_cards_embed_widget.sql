-- Create widget_settings table
CREATE TABLE widget_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  allowed_domains TEXT[] DEFAULT ARRAY[]::TEXT[],
  header_color TEXT DEFAULT '#0A1628',
  button_color TEXT DEFAULT '#D4AF37',
  text_color TEXT DEFAULT '#FFFFFF',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE widget_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for widget_settings" ON widget_settings FOR ALL USING (true) WITH CHECK (true);

-- Create widget_leads table
CREATE TABLE widget_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  consultant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT DEFAULT 'new',
  origin_domain TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE widget_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for widget_leads" ON widget_leads FOR ALL USING (true) WITH CHECK (true);

-- Add RLS for profiles to allow branch_manager and company_admin to see consultants in their branch/company
DROP POLICY IF EXISTS "Allow branch_manager to view their consultants" ON public.profiles;
CREATE POLICY "Allow branch_manager to view their consultants" ON public.profiles FOR SELECT USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'branch_manager' AND branch_id = profiles.branch_id));

DROP POLICY IF EXISTS "Allow company_admin to view their branches' consultants" ON public.profiles;
CREATE POLICY "Allow company_admin to view their branches' consultants" ON public.profiles FOR SELECT USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'company_admin' AND company_id = profiles.company_id));

-- Add RLS for branches to allow company_admin to view their branches
DROP POLICY IF EXISTS "Allow company_admin to view their branches" ON public.branches;
CREATE POLICY "Allow company_admin to view their branches" ON public.branches FOR SELECT USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'company_admin' AND company_id = branches.company_id));

-- Add RLS for companies to allow company_admin to view their company
DROP POLICY IF EXISTS "Allow company_admin to view their company" ON public.companies;
CREATE POLICY "Allow company_admin to view their company" ON public.companies FOR SELECT USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'company_admin' AND id = companies.id));

-- Update app_role enum to include 'company_admin' and 'branch_manager'
ALTER TYPE app_role ADD VALUE 'company_admin';
ALTER TYPE app_role ADD VALUE 'branch_manager';

-- Backfill existing 'admin' roles to 'branch_manager'
UPDATE public.user_roles SET role = 'branch_manager' WHERE role = 'admin';

-- Backfill existing 'agent' roles to 'consultant'
UPDATE public.user_roles SET role = 'consultant' WHERE role = 'agent';

-- Update profiles table to include company_id and branch_id
ALTER TABLE public.profiles ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- Update existing profiles to link to companies/branches based on their previous admin_id
-- This is a placeholder and needs more complex logic based on how you map old admins to new companies/branches
-- For now, we'll assume a direct mapping or leave it null for manual assignment
-- Example: UPDATE public.profiles SET branch_id = (SELECT id FROM public.branches WHERE branch_manager_id = profiles.id) WHERE role = 'branch_manager';

-- Create a trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_widget_settings_updated_at
BEFORE UPDATE ON widget_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_widget_leads_updated_at
BEFORE UPDATE ON widget_leads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
