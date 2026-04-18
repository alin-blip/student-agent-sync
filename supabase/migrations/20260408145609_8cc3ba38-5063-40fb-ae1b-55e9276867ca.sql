
-- Step 1: Drop old constraint FIRST
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_status_check;

-- Step 2: Migrate existing data
UPDATE public.enrollments SET status = 'new_application' WHERE status = 'applied';
UPDATE public.enrollments SET status = 'processing' WHERE status IN ('documents_pending', 'documents_submitted');
UPDATE public.enrollments SET status = 'final_offer' WHERE status IN ('offer_received', 'accepted', 'funding');
UPDATE public.enrollments SET status = 'enrolled' WHERE status = 'active';
UPDATE public.enrollments SET status = 'commission_paid' WHERE status = 'paid_by_university';
UPDATE public.enrollments SET status = 'fail' WHERE status = 'rejected';

-- Step 3: Add new constraint
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_status_check CHECK (
  status = ANY (ARRAY[
    'new_application'::text, 'processing'::text, 'assessment_booked'::text,
    'pass'::text, 'fail'::text, 'additional_requirements'::text,
    'final_offer'::text, 'enrolled'::text,
    'commission_25_ready'::text, 'commission_paid'::text,
    'withdrawn'::text, 'cancelled'::text, 'transferred'::text
  ])
);

-- Step 4: Add commission_tranches to commission_snapshots
ALTER TABLE public.commission_snapshots ADD COLUMN IF NOT EXISTS commission_tranches integer NOT NULL DEFAULT 1;

-- Step 5: Rewrite the commission trigger function
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
  _intake_id uuid;
  _agent_rate numeric := 0;
  _admin_rate numeric := 0;
  _rate_source text := 'None';
  _uc_rate numeric;
  _tier_rate numeric;
  _tier_name text;
  _count integer;
  _existing uuid;
  _last_agent_rate numeric;
  _last_agent_tier text;
  _last_admin_rate numeric;
  _new_agent_tier_name text;
  _admin_tier_rate numeric;
  _admin_tier_name text;
  _admin_student_count integer;
BEGIN
  -- Cancel snapshots on terminal negative statuses
  IF NEW.status IN ('withdrawn', 'cancelled', 'fail') THEN
    UPDATE public.commission_snapshots
    SET snapshot_status = 'cancelled'
    WHERE enrollment_id = NEW.id
      AND snapshot_status <> 'cancelled';
    RETURN NEW;
  END IF;

  -- Create snapshot when reaching final_offer
  IF NEW.status = 'final_offer'
     AND (OLD.status IS NULL OR OLD.status NOT IN ('final_offer', 'enrolled', 'commission_25_ready', 'commission_paid')) THEN

    SELECT id INTO _existing FROM public.commission_snapshots WHERE enrollment_id = NEW.id;
    IF _existing IS NOT NULL THEN
      NULL;
    ELSE
      SELECT s.agent_id INTO _agent_id FROM public.students s WHERE s.id = NEW.student_id;
      SELECT p.admin_id INTO _admin_id FROM public.profiles p WHERE p.id = _agent_id;
      _uni_id := NEW.university_id;
      _intake_id := NEW.intake_id;

      SELECT count(*) INTO _count FROM public.commission_tiers WHERE university_id = _uni_id;
      IF _count > 0 THEN
        SELECT count(*) INTO _count FROM public.enrollments e JOIN public.students s ON e.student_id = s.id
          WHERE s.agent_id = _agent_id AND e.university_id = _uni_id
          AND (_intake_id IS NULL OR e.intake_id = _intake_id)
          AND e.status IN ('final_offer', 'enrolled', 'commission_25_ready', 'commission_paid');
        SELECT ct.commission_per_student, ct.tier_name INTO _tier_rate, _tier_name FROM public.commission_tiers ct
          WHERE ct.university_id = _uni_id AND _count >= ct.min_students AND (ct.max_students IS NULL OR _count <= ct.max_students)
          ORDER BY ct.min_students DESC LIMIT 1;
        IF _tier_rate IS NOT NULL AND _tier_rate > 0 THEN
          _agent_rate := _tier_rate; _rate_source := 'Uni Tier: ' || _tier_name;
          _new_agent_tier_name := _tier_name;
        END IF;
      END IF;

      IF _agent_rate = 0 THEN
        SELECT uc.commission_per_student INTO _uc_rate FROM public.university_commissions uc WHERE uc.university_id = _uni_id;
        IF FOUND AND _uc_rate > 0 THEN
          _agent_rate := _uc_rate; _rate_source := 'Custom'; _new_agent_tier_name := 'Custom';
        END IF;
      END IF;

      IF _agent_rate = 0 THEN
        SELECT count(*) INTO _count FROM public.enrollments e JOIN public.students s ON e.student_id = s.id
          WHERE s.agent_id = _agent_id
          AND (_intake_id IS NULL OR e.intake_id = _intake_id)
          AND e.status IN ('final_offer', 'enrolled', 'commission_25_ready', 'commission_paid');
        SELECT ct.commission_per_student, ct.tier_name INTO _tier_rate, _tier_name FROM public.commission_tiers ct
          WHERE ct.university_id IS NULL AND _count >= ct.min_students AND (ct.max_students IS NULL OR _count <= ct.max_students)
          ORDER BY ct.min_students DESC LIMIT 1;
        IF _tier_rate IS NOT NULL AND _tier_rate > 0 THEN
          _agent_rate := _tier_rate; _rate_source := 'Global: ' || _tier_name;
          _new_agent_tier_name := _tier_name;
        END IF;
      END IF;

      SELECT cs.agent_rate, cs.rate_source INTO _last_agent_rate, _last_agent_tier
        FROM public.commission_snapshots cs
        JOIN public.enrollments e2 ON cs.enrollment_id = e2.id
        WHERE cs.agent_id = _agent_id
        AND (_intake_id IS NULL OR e2.intake_id = _intake_id)
        AND cs.snapshot_status NOT IN ('cancelled')
        ORDER BY cs.created_at DESC LIMIT 1;

      IF _last_agent_rate IS NOT NULL AND _agent_rate > _last_agent_rate THEN
        INSERT INTO public.tier_upgrade_requests (user_id, user_role, current_tier_name, new_tier_name, current_rate, new_rate, student_count, status)
        VALUES (_agent_id, 'agent', COALESCE(_last_agent_tier, 'None'), COALESCE(_rate_source, 'None'), _last_agent_rate, _agent_rate, _count, 'pending');
        _agent_rate := _last_agent_rate;
        _rate_source := _last_agent_tier;
      END IF;

      IF _admin_id IS NOT NULL THEN
        SELECT count(*) INTO _admin_student_count
          FROM public.enrollments e JOIN public.students s ON e.student_id = s.id
          JOIN public.profiles p ON s.agent_id = p.id
          WHERE p.admin_id = _admin_id
          AND (_intake_id IS NULL OR e.intake_id = _intake_id)
          AND e.status IN ('final_offer', 'enrolled', 'commission_25_ready', 'commission_paid');

        SELECT act.rate_per_student, act.tier_name INTO _admin_tier_rate, _admin_tier_name
          FROM public.admin_commission_tiers act
          WHERE (act.admin_id = _admin_id OR act.admin_id IS NULL)
          AND _admin_student_count >= act.min_students
          AND (act.max_students IS NULL OR _admin_student_count <= act.max_students)
          ORDER BY act.admin_id NULLS LAST, act.min_students DESC LIMIT 1;

        _admin_rate := COALESCE(_admin_tier_rate, 0);

        SELECT cs.admin_rate INTO _last_admin_rate
          FROM public.commission_snapshots cs
          JOIN public.enrollments e2 ON cs.enrollment_id = e2.id
          WHERE cs.admin_id = _admin_id
          AND (_intake_id IS NULL OR e2.intake_id = _intake_id)
          AND cs.snapshot_status NOT IN ('cancelled')
          ORDER BY cs.created_at DESC LIMIT 1;

        IF _last_admin_rate IS NOT NULL AND _admin_rate > _last_admin_rate THEN
          INSERT INTO public.tier_upgrade_requests (user_id, user_role, current_tier_name, new_tier_name, current_rate, new_rate, student_count, status)
          VALUES (_admin_id, 'admin', COALESCE(_last_admin_rate::text, 'None'), COALESCE(_admin_tier_name, 'None'), _last_admin_rate, _admin_rate, _admin_student_count, 'pending');
          _admin_rate := _last_admin_rate;
        END IF;
      END IF;

      INSERT INTO public.commission_snapshots (enrollment_id, agent_id, admin_id, university_id, agent_rate, admin_rate, rate_source, snapshot_status, eligible_at)
      VALUES (NEW.id, _agent_id, _admin_id, _uni_id, COALESCE(_agent_rate, 0), COALESCE(_admin_rate, 0), COALESCE(_rate_source, 'None'), 'pending_25', now());
    END IF;
  END IF;

  IF NEW.funding_status = 'approved' AND (OLD.funding_status IS DISTINCT FROM 'approved') THEN
    SELECT id INTO _existing FROM public.commission_snapshots WHERE enrollment_id = NEW.id;
    IF _existing IS NULL THEN
      SELECT s.agent_id INTO _agent_id FROM public.students s WHERE s.id = NEW.student_id;
      SELECT p.admin_id INTO _admin_id FROM public.profiles p WHERE p.id = _agent_id;
      _uni_id := NEW.university_id;
      _intake_id := NEW.intake_id;
      _agent_rate := 0; _admin_rate := 0; _rate_source := 'None';

      SELECT uc.commission_per_student INTO _uc_rate FROM public.university_commissions uc WHERE uc.university_id = _uni_id;
      IF FOUND AND _uc_rate > 0 THEN
        _agent_rate := _uc_rate; _rate_source := 'Custom';
      END IF;

      IF _agent_rate = 0 THEN
        SELECT count(*) INTO _count FROM public.enrollments e JOIN public.students s ON e.student_id = s.id
          WHERE s.agent_id = _agent_id
          AND (_intake_id IS NULL OR e.intake_id = _intake_id)
          AND e.status IN ('final_offer', 'enrolled', 'commission_25_ready', 'commission_paid');
        SELECT ct.commission_per_student, ct.tier_name INTO _tier_rate, _tier_name FROM public.commission_tiers ct
          WHERE ct.university_id IS NULL AND _count >= ct.min_students AND (ct.max_students IS NULL OR _count <= ct.max_students)
          ORDER BY ct.min_students DESC LIMIT 1;
        IF _tier_rate IS NOT NULL THEN _agent_rate := _tier_rate; _rate_source := 'Global: ' || _tier_name; END IF;
      END IF;

      IF _admin_id IS NOT NULL THEN
        SELECT act.rate_per_student INTO _admin_tier_rate FROM public.admin_commission_tiers act
          WHERE (act.admin_id = _admin_id OR act.admin_id IS NULL)
          ORDER BY act.admin_id NULLS LAST, act.min_students DESC LIMIT 1;
        _admin_rate := COALESCE(_admin_tier_rate, 0);
      END IF;

      INSERT INTO public.commission_snapshots (enrollment_id, agent_id, admin_id, university_id, agent_rate, admin_rate, rate_source, snapshot_status, eligible_at)
      VALUES (NEW.id, _agent_id, _admin_id, _uni_id, COALESCE(_agent_rate, 0), COALESCE(_admin_rate, 0), COALESCE(_rate_source, 'None'), 'pending_25', now());
    END IF;
  END IF;

  -- Full release on commission_paid
  IF NEW.status = 'commission_paid' AND (OLD.status IS DISTINCT FROM 'commission_paid') THEN
    UPDATE public.commission_snapshots SET snapshot_status = 'ready_full', full_release_at = now()
      WHERE enrollment_id = NEW.id AND snapshot_status IN ('pending_25', 'paying_25');
  END IF;

  RETURN NEW;
END;
$function$;
