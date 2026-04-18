
-- Add source and student_id columns to tasks
ALTER TABLE public.tasks ADD COLUMN source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.tasks ADD COLUMN student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;

-- Agent can insert own tasks (personal to-dos)
CREATE POLICY "Agent inserts own tasks"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() AND assigned_to = auth.uid()
);

-- Agent can delete tasks they created themselves
CREATE POLICY "Agent deletes own created tasks"
ON public.tasks FOR DELETE TO authenticated
USING (
  created_by = auth.uid() AND assigned_to = auth.uid()
);
