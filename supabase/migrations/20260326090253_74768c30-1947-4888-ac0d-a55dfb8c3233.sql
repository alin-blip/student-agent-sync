
-- Notes/activity log per student
CREATE TABLE public.student_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  note_type text NOT NULL DEFAULT 'note',
  is_agent_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add funding fields to enrollments
ALTER TABLE public.enrollments 
  ADD COLUMN funding_status text DEFAULT 'not_started',
  ADD COLUMN funding_type text,
  ADD COLUMN funding_reference text,
  ADD COLUMN funding_notes text;

-- Enable RLS on student_notes
ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

-- Owner: full access to all notes
CREATE POLICY "Owner manages all notes"
  ON public.student_notes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

-- Admin: read notes for own + team students
CREATE POLICY "Admin reads team notes"
  ON public.student_notes FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND (
      student_id IN (
        SELECT s.id FROM students s WHERE s.agent_id = auth.uid()
      ) OR student_id IN (
        SELECT s.id FROM students s
        JOIN profiles p ON s.agent_id = p.id
        WHERE p.admin_id = auth.uid()
      )
    )
  );

-- Admin: insert notes for own + team students
CREATE POLICY "Admin inserts team notes"
  ON public.student_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid() AND (
      student_id IN (
        SELECT s.id FROM students s WHERE s.agent_id = auth.uid()
      ) OR student_id IN (
        SELECT s.id FROM students s
        JOIN profiles p ON s.agent_id = p.id
        WHERE p.admin_id = auth.uid()
      )
    )
  );

-- Agent: read visible notes for own students
CREATE POLICY "Agent reads own student notes"
  ON public.student_notes FOR SELECT
  TO authenticated
  USING (
    is_agent_visible = true AND student_id IN (
      SELECT s.id FROM students s WHERE s.agent_id = auth.uid()
    )
  );

-- Agent: insert notes for own students
CREATE POLICY "Agent inserts own student notes"
  ON public.student_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND student_id IN (
      SELECT s.id FROM students s WHERE s.agent_id = auth.uid()
    )
  );
