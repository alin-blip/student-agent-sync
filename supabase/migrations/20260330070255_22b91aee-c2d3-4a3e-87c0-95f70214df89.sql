
CREATE TABLE public.student_finance_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  agent_id uuid NOT NULL,
  method text NOT NULL DEFAULT 'platform',
  uploaded_file_path text,
  -- Personal Details
  title text,
  relationship_status text,
  first_name text,
  family_name text,
  date_of_birth text,
  nationality text,
  town_of_birth text,
  -- Contact Details
  email text,
  phone text,
  ni_number text,
  current_address text,
  applied_before text,
  applied_before_details text,
  -- Immigration Status
  immigration_status text,
  share_code text,
  expiry_date text,
  -- Employment
  worked_last_3_months text,
  employment_type text,
  job_title_company text,
  -- Address History
  address_history_1 text,
  address_history_2 text,
  address_history_3 text,
  -- University/Course
  university_name_address text,
  course_name text,
  course_length_start text,
  year_tuition_fee text,
  -- UK Contacts
  uk_contact_1_name text,
  uk_contact_1_relationship text,
  uk_contact_1_phone text,
  uk_contact_1_address text,
  uk_contact_2_name text,
  uk_contact_2_relationship text,
  uk_contact_2_phone text,
  uk_contact_2_address text,
  -- CRN
  crn text,
  password text,
  secret_answer text,
  -- Financial Details (Spouse)
  spouse_marriage_date text,
  spouse_full_name text,
  spouse_dob text,
  spouse_address text,
  spouse_phone text,
  spouse_email text,
  spouse_ni_number text,
  spouse_place_of_birth text,
  spouse_employment_status text,
  spouse_has_income text,
  -- Dependants
  dependants_info text,
  -- Consent
  consent_full_name text,
  consent_date text,
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_finance_forms ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "Owner manages all finance forms"
  ON public.student_finance_forms FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Agent manages own students' forms
CREATE POLICY "Agent manages own finance forms"
  ON public.student_finance_forms FOR ALL
  TO authenticated
  USING (student_id IN (SELECT s.id FROM public.students s WHERE s.agent_id = auth.uid()))
  WITH CHECK (student_id IN (SELECT s.id FROM public.students s WHERE s.agent_id = auth.uid()));

-- Admin reads team finance forms
CREATE POLICY "Admin reads team finance forms"
  ON public.student_finance_forms FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') AND (
      student_id IN (SELECT s.id FROM public.students s WHERE s.agent_id = auth.uid())
      OR student_id IN (SELECT s.id FROM public.students s JOIN public.profiles p ON s.agent_id = p.id WHERE p.admin_id = auth.uid())
    )
  );

-- Admin inserts for own students
CREATE POLICY "Admin inserts own finance forms"
  ON public.student_finance_forms FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') AND agent_id = auth.uid()
    AND student_id IN (SELECT s.id FROM public.students s WHERE s.agent_id = auth.uid())
  );

-- Admin updates team forms
CREATE POLICY "Admin updates team finance forms"
  ON public.student_finance_forms FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') AND (
      student_id IN (SELECT s.id FROM public.students s WHERE s.agent_id = auth.uid())
      OR student_id IN (SELECT s.id FROM public.students s JOIN public.profiles p ON s.agent_id = p.id WHERE p.admin_id = auth.uid())
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_student_finance_forms_updated_at
  BEFORE UPDATE ON public.student_finance_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
