-- Create company_applications table
CREATE TABLE company_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_type TEXT,
  city TEXT,
  num_locations INTEGER,
  num_employees TEXT,
  network_access TEXT[],
  network_size TEXT,
  motivation TEXT,
  how_heard TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected')),
  notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE company_applications ENABLE ROW LEVEL SECURITY;

-- RLS for company_applications
CREATE POLICY "Super admin can view all company applications" ON company_applications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "Super admin can insert company applications" ON company_applications FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "Super admin can update company applications" ON company_applications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "Public can insert company applications" ON company_applications FOR INSERT WITH CHECK (true);

-- Create a trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_applications_updated_at
BEFORE UPDATE ON company_applications
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
