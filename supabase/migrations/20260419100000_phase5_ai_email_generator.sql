-- Create generated_email_sequences table
CREATE TABLE generated_email_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  audience TEXT,
  tone TEXT,
  email_count INTEGER,
  emails_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE generated_email_sequences ENABLE ROW LEVEL SECURITY;

-- RLS for generated_email_sequences
CREATE POLICY "Users can view their own generated email sequences" ON generated_email_sequences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own generated email sequences" ON generated_email_sequences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Company admins can view their company's generated email sequences" ON generated_email_sequences FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND company_id = generated_email_sequences.company_id AND role = 'company_admin'));
CREATE POLICY "Branch managers can view their branch's generated email sequences" ON generated_email_sequences FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND branch_id = generated_email_sequences.branch_id AND role = 'branch_manager'));
