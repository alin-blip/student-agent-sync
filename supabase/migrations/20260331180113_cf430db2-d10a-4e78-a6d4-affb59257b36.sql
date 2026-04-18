
-- 1. Create audit_log table
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: only owner can read audit logs
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads all audit logs"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Admin reads team audit logs"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role inserts (from triggers)
CREATE POLICY "Service role inserts audit logs"
  ON public.audit_log FOR INSERT TO public
  WITH CHECK (true);

-- 2. Create audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  BEGIN
    _user_id := (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
  EXCEPTION WHEN OTHERS THEN
    _user_id := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_values)
    VALUES (_user_id, 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (_user_id, 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values)
    VALUES (_user_id, 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 3. Attach triggers to critical tables
CREATE TRIGGER audit_students
  AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_enrollments
  AFTER INSERT OR UPDATE OR DELETE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_student_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.student_documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_student_notes
  AFTER INSERT OR UPDATE OR DELETE ON public.student_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 4. Server-side: prevent agents from updating sensitive student fields
CREATE OR REPLACE FUNCTION public.protect_student_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _role app_role;
BEGIN
  BEGIN
    _user_id := (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  SELECT role INTO _role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;

  -- Only restrict agents (not owner/admin)
  IF _role = 'agent' THEN
    -- Prevent changing sensitive fields after creation
    IF OLD.first_name IS DISTINCT FROM NEW.first_name THEN
      RAISE EXCEPTION 'Agents cannot modify student first name';
    END IF;
    IF OLD.last_name IS DISTINCT FROM NEW.last_name THEN
      RAISE EXCEPTION 'Agents cannot modify student last name';
    END IF;
    IF OLD.date_of_birth IS DISTINCT FROM NEW.date_of_birth THEN
      RAISE EXCEPTION 'Agents cannot modify student date of birth';
    END IF;
    IF OLD.immigration_status IS DISTINCT FROM NEW.immigration_status THEN
      RAISE EXCEPTION 'Agents cannot modify student immigration status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_student_fields
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.protect_student_sensitive_fields();
