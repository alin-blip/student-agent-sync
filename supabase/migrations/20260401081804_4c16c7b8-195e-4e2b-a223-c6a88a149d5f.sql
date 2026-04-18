
-- 1. Create admin_commission_tiers table
CREATE TABLE public.admin_commission_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid DEFAULT NULL,
  tier_name text NOT NULL,
  min_students integer NOT NULL DEFAULT 0,
  max_students integer DEFAULT NULL,
  rate_per_student numeric NOT NULL DEFAULT 100,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_commission_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages admin commission tiers" ON public.admin_commission_tiers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admin reads own tiers" ON public.admin_commission_tiers
  FOR SELECT TO authenticated
  USING (admin_id = auth.uid() OR admin_id IS NULL);

-- Seed default global admin tiers
INSERT INTO public.admin_commission_tiers (tier_name, min_students, max_students, rate_per_student) VALUES
  ('Starter', 0, 29, 100),
  ('Silver', 30, 49, 150),
  ('Gold', 50, NULL, 200);

-- 2. Create tier_upgrade_requests table
CREATE TABLE public.tier_upgrade_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_role text NOT NULL DEFAULT 'agent',
  current_tier_name text NOT NULL DEFAULT '',
  new_tier_name text NOT NULL DEFAULT '',
  current_rate numeric NOT NULL DEFAULT 0,
  new_rate numeric NOT NULL DEFAULT 0,
  student_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone DEFAULT NULL,
  reviewed_by uuid DEFAULT NULL
);

ALTER TABLE public.tier_upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages all upgrade requests" ON public.tier_upgrade_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Agent reads own upgrade requests" ON public.tier_upgrade_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin reads own upgrade requests" ON public.tier_upgrade_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. Update the snapshot trigger to detect tier jumps and create upgrade requests
CREATE OR REPLACE FUNCTION public.create_commission_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  _last_agent_rate numeric;
  _last_agent_tier text;
  _last_admin_rate numeric;
  _last_admin_tier text;
  _new_agent_tier_name text;
  _new_admin_tier_name text;
  _admin_tier_rate numeric;
  _admin_tier_name text;
  _admin_student_count integer;
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
        _new_agent_tier_name := _tier_name;
      END IF;
    END IF;

    -- P2: Uni commission
    IF _agent_rate = 0 THEN
      SELECT uc.commission_per_student, uc.tier_id INTO _uc_rate, _uc_tier_id FROM university_commissions uc WHERE uc.university_id = _uni_id;
      IF FOUND THEN
        IF _uc_tier_id IS NOT NULL THEN
          SELECT ct.commission_per_student, ct.tier_name INTO _tier_rate, _tier_name FROM commission_tiers ct WHERE ct.id = _uc_tier_id;
          IF FOUND THEN _agent_rate := _tier_rate; _rate_source := 'Tier: ' || _tier_name; _new_agent_tier_name := _tier_name;
          ELSE _agent_rate := _uc_rate; _rate_source := 'Custom'; _new_agent_tier_name := 'Custom'; END IF;
        ELSE _agent_rate := _uc_rate; _rate_source := 'Custom'; _new_agent_tier_name := 'Custom'; END IF;
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
        _new_agent_tier_name := _tier_name;
      END IF;
    END IF;

    -- Check agent tier upgrade: compare with last snapshot rate
    SELECT cs.agent_rate, cs.rate_source INTO _last_agent_rate, _last_agent_tier
      FROM commission_snapshots cs WHERE cs.agent_id = _agent_id
      ORDER BY cs.created_at DESC LIMIT 1;

    IF _last_agent_rate IS NOT NULL AND _agent_rate > _last_agent_rate THEN
      -- Tier upgrade detected — create request, use OLD rate for snapshot
      INSERT INTO tier_upgrade_requests (user_id, user_role, current_tier_name, new_tier_name, current_rate, new_rate, student_count, status)
      VALUES (_agent_id, 'agent', COALESCE(_last_agent_tier, 'None'), COALESCE(_rate_source, 'None'), _last_agent_rate, _agent_rate, _count, 'pending');
      -- Use old rate until approved
      _agent_rate := _last_agent_rate;
      _rate_source := _last_agent_tier;
    END IF;

    -- Admin rate from admin_commission_tiers
    IF _admin_id IS NOT NULL THEN
      -- Count admin's team funded students
      SELECT count(*) INTO _admin_student_count
        FROM enrollments e JOIN students s ON e.student_id = s.id
        JOIN profiles p ON s.agent_id = p.id
        WHERE p.admin_id = _admin_id AND e.funding_status = 'approved';

      -- Check admin-specific tiers first, then global admin tiers
      SELECT act.rate_per_student, act.tier_name INTO _admin_tier_rate, _admin_tier_name
        FROM admin_commission_tiers act
        WHERE (act.admin_id = _admin_id OR act.admin_id IS NULL)
        AND _admin_student_count >= act.min_students
        AND (act.max_students IS NULL OR _admin_student_count <= act.max_students)
        ORDER BY act.admin_id NULLS LAST, act.min_students DESC LIMIT 1;

      _admin_rate := COALESCE(_admin_tier_rate, 0);

      -- Check admin tier upgrade
      SELECT cs.admin_rate INTO _last_admin_rate
        FROM commission_snapshots cs WHERE cs.admin_id = _admin_id
        ORDER BY cs.created_at DESC LIMIT 1;

      IF _last_admin_rate IS NOT NULL AND _admin_rate > _last_admin_rate THEN
        INSERT INTO tier_upgrade_requests (user_id, user_role, current_tier_name, new_tier_name, current_rate, new_rate, student_count, status)
        VALUES (_admin_id, 'admin', COALESCE(_last_admin_rate::text, 'None'), COALESCE(_admin_tier_name, 'None'), _last_admin_rate, _admin_rate, _admin_student_count, 'pending');
        _admin_rate := _last_admin_rate;
      END IF;
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
$function$;
