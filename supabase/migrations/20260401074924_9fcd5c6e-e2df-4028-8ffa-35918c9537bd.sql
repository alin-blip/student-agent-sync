
-- Tables
CREATE TABLE public.commission_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE UNIQUE,
  agent_id uuid NOT NULL,
  admin_id uuid,
  university_id uuid NOT NULL,
  agent_rate numeric NOT NULL DEFAULT 0,
  admin_rate numeric NOT NULL DEFAULT 0,
  rate_source text NOT NULL DEFAULT 'Global',
  snapshot_status text NOT NULL DEFAULT 'pending_25',
  eligible_at timestamptz NOT NULL DEFAULT now(),
  full_release_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commission_snapshots ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.commission_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id uuid NOT NULL REFERENCES public.commission_snapshots(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,
  recipient_role text NOT NULL DEFAULT 'agent',
  amount numeric NOT NULL DEFAULT 0,
  payment_type text NOT NULL DEFAULT '25_percent_monthly',
  period_label text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  paid_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_commission_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL UNIQUE,
  rate_per_student numeric NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_commission_settings ENABLE ROW LEVEL SECURITY;

-- RLS: commission_snapshots
CREATE POLICY "Owner manages all snapshots" ON public.commission_snapshots FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role)) WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Admin reads team snapshots" ON public.commission_snapshots FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND (agent_id = auth.uid() OR agent_id IN (SELECT p.id FROM profiles p WHERE p.admin_id = auth.uid())));
CREATE POLICY "Agent reads own snapshots" ON public.commission_snapshots FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- RLS: commission_payments
CREATE POLICY "Owner manages all payments" ON public.commission_payments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role)) WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Admin reads team payments" ON public.commission_payments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND (recipient_id = auth.uid() OR recipient_id IN (SELECT p.id FROM profiles p WHERE p.admin_id = auth.uid())));
CREATE POLICY "Agent reads own payments" ON public.commission_payments FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

-- RLS: admin_commission_settings
CREATE POLICY "Owner manages admin commission settings" ON public.admin_commission_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role)) WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Admin reads own commission settings" ON public.admin_commission_settings FOR SELECT TO authenticated
  USING (admin_id = auth.uid());

-- Trigger function
CREATE OR REPLACE FUNCTION public.create_commission_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _agent_id uuid;
  _admin_id uuid;
  _uni_id uuid;
  _agent_rate numeric := 0;
  _admin_rate numeric := 0;
  _rate_source text := 'None';
  _uc_rate numeric;
  _uc_tier_id uuid;
  _tier_rate numeric;
  _tier_name text;
  _count integer;
  _existing uuid;
BEGIN
  IF NEW.funding_status = 'approved' AND (OLD.funding_status IS DISTINCT FROM 'approved') THEN
    SELECT id INTO _existing FROM commission_snapshots WHERE enrollment_id = NEW.id;
    IF _existing IS NOT NULL THEN RETURN NEW; END IF;

    SELECT s.agent_id INTO _agent_id FROM students s WHERE s.id = NEW.student_id;
    SELECT p.admin_id INTO _admin_id FROM profiles p WHERE p.id = _agent_id;
    _uni_id := NEW.university_id;

    -- P1: Uni tiers
    SELECT count(*) INTO _count FROM commission_tiers WHERE university_id = _uni_id;
    IF _count > 0 THEN
      SELECT count(*) INTO _count FROM enrollments e JOIN students s ON e.student_id = s.id
        WHERE s.agent_id = _agent_id AND e.university_id = _uni_id AND e.funding_status = 'approved';
      SELECT ct.commission_per_student, ct.tier_name INTO _tier_rate, _tier_name FROM commission_tiers ct
        WHERE ct.university_id = _uni_id AND _count >= ct.min_students AND (ct.max_students IS NULL OR _count <= ct.max_students)
        ORDER BY ct.min_students DESC LIMIT 1;
      IF _tier_rate IS NOT NULL AND _tier_rate > 0 THEN
        _agent_rate := _tier_rate; _rate_source := 'Uni Tier: ' || _tier_name;
      END IF;
    END IF;

    -- P2: Uni commission
    IF _agent_rate = 0 THEN
      SELECT uc.commission_per_student, uc.tier_id INTO _uc_rate, _uc_tier_id FROM university_commissions uc WHERE uc.university_id = _uni_id;
      IF FOUND THEN
        IF _uc_tier_id IS NOT NULL THEN
          SELECT ct.commission_per_student, ct.tier_name INTO _tier_rate, _tier_name FROM commission_tiers ct WHERE ct.id = _uc_tier_id;
          IF FOUND THEN _agent_rate := _tier_rate; _rate_source := 'Tier: ' || _tier_name;
          ELSE _agent_rate := _uc_rate; _rate_source := 'Custom'; END IF;
        ELSE _agent_rate := _uc_rate; _rate_source := 'Custom'; END IF;
      END IF;
    END IF;

    -- P3: Global tiers
    IF _agent_rate = 0 THEN
      SELECT count(*) INTO _count FROM enrollments e JOIN students s ON e.student_id = s.id
        WHERE s.agent_id = _agent_id AND e.funding_status = 'approved';
      SELECT ct.commission_per_student, ct.tier_name INTO _tier_rate, _tier_name FROM commission_tiers ct
        WHERE ct.university_id IS NULL AND _count >= ct.min_students AND (ct.max_students IS NULL OR _count <= ct.max_students)
        ORDER BY ct.min_students DESC LIMIT 1;
      IF _tier_rate IS NOT NULL AND _tier_rate > 0 THEN
        _agent_rate := _tier_rate; _rate_source := 'Global: ' || _tier_name;
      END IF;
    END IF;

    -- Admin rate
    IF _admin_id IS NOT NULL THEN
      SELECT acs.rate_per_student INTO _admin_rate FROM admin_commission_settings acs WHERE acs.admin_id = _admin_id;
      _admin_rate := COALESCE(_admin_rate, 0);
    END IF;

    INSERT INTO commission_snapshots (enrollment_id, agent_id, admin_id, university_id, agent_rate, admin_rate, rate_source, snapshot_status, eligible_at)
    VALUES (NEW.id, _agent_id, _admin_id, _uni_id, COALESCE(_agent_rate, 0), COALESCE(_admin_rate, 0), COALESCE(_rate_source, 'None'), 'pending_25', now());
  END IF;

  IF NEW.status = 'paid_by_university' AND (OLD.status IS DISTINCT FROM 'paid_by_university') THEN
    UPDATE commission_snapshots SET snapshot_status = 'ready_full', full_release_at = now()
      WHERE enrollment_id = NEW.id AND snapshot_status IN ('pending_25', 'paying_25');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_commission_snapshot AFTER UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.create_commission_snapshot();

CREATE TRIGGER audit_commission_snapshots AFTER INSERT OR UPDATE OR DELETE ON public.commission_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_commission_payments AFTER INSERT OR UPDATE OR DELETE ON public.commission_payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
