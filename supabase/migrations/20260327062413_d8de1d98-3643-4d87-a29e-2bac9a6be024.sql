
-- Create tasks table
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Owner: full access
CREATE POLICY "Owner manages all tasks"
  ON public.tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Admin: SELECT tasks they created, assigned to them, or assigned to their agents
CREATE POLICY "Admin reads tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') AND (
      created_by = auth.uid()
      OR assigned_to = auth.uid()
      OR assigned_to IN (SELECT id FROM public.profiles WHERE admin_id = auth.uid())
    )
  );

-- Admin: INSERT tasks
CREATE POLICY "Admin inserts tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') AND created_by = auth.uid()
  );

-- Admin: UPDATE tasks they created or assigned to their team
CREATE POLICY "Admin updates tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') AND (
      created_by = auth.uid()
      OR assigned_to = auth.uid()
      OR assigned_to IN (SELECT id FROM public.profiles WHERE admin_id = auth.uid())
    )
  );

-- Agent: SELECT own tasks
CREATE POLICY "Agent reads own tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (assigned_to = auth.uid());

-- Agent: UPDATE own tasks (status only enforced in UI)
CREATE POLICY "Agent updates own tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid());
