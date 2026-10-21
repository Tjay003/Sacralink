-- ==============================================================================
-- MIGRATION 055: Optional priest request at booking
-- A parishioner may ask for a specific priest of the parish when booking. The request is
-- a preference, never the assignment: appointments.priest_id (the celebrant) is still set
-- only when the parish office approves or changes the celebrant.
--
-- 1. appointments.requested_priest_id: nullable, cleared (not cascaded) when the priest's
--    profile is deleted. Existing rows and clients that never send it (the mobile app) are
--    unaffected.
-- 2. A trigger keeps the request honest: it must name a priest of the appointment's parish
--    (the same membership rule as get_parish_clergy). The parishioner INSERT and pending
--    UPDATE policies already let a user write their own request, so no policy changes.
-- 3. approve_appointment (signature and behavior unchanged) adds one sentence to the
--    parishioner's approval notification when the request exists and the approved celebrant
--    is someone else (or nobody), so the parishioner knows the request was not honored.
--    The leave reason of any priest is never read or written here.
-- ==============================================================================

-- 1. The request
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS requested_priest_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_requested_priest
  ON public.appointments(requested_priest_id)
  WHERE requested_priest_id IS NOT NULL;

-- 2. The requested priest must belong to the appointment's parish
CREATE OR REPLACE FUNCTION public.validate_requested_priest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.requested_priest_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = NEW.requested_priest_id
      AND (pr.assigned_church_id = NEW.church_id OR pr.church_id = NEW.church_id)
      AND (COALESCE(pr.is_priest, false) OR pr.role::text = 'priest')
  ) THEN
    RAISE EXCEPTION 'The requested priest is not a priest of this parish' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_requested_priest() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_requested_priest ON public.appointments;
CREATE TRIGGER validate_requested_priest
  BEFORE INSERT OR UPDATE OF requested_priest_id, church_id ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_requested_priest();

-- 3. approve_appointment: same signature and behavior as migration 052, plus the substitution sentence
CREATE OR REPLACE FUNCTION public.approve_appointment(
  p_appointment_id UUID,
  p_priest_id UUID DEFAULT NULL,
  p_admin_feedback TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_actor_church UUID;
  v_apt public.appointments%ROWTYPE;
  v_feedback TEXT := NULLIF(btrim(COALESCE(p_admin_feedback, '')), '');
  v_priest_ok BOOLEAN;
  v_requested_name TEXT;
  v_assigned_name TEXT;
  v_message TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT role::text, COALESCE(assigned_church_id, church_id)
    INTO v_actor_role, v_actor_church
  FROM public.profiles
  WHERE id = v_actor_id;

  SELECT * INTO v_apt
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_actor_role IS NULL
     OR v_actor_role NOT IN ('super_admin', 'admin', 'church_admin')
     OR (v_actor_role <> 'super_admin' AND v_actor_church IS DISTINCT FROM v_apt.church_id) THEN
    RAISE EXCEPTION 'Only the parish office can approve this appointment' USING ERRCODE = '42501';
  END IF;

  IF v_apt.status::text <> 'pending' THEN
    RAISE EXCEPTION 'Only pending appointments can be approved' USING ERRCODE = '22023';
  END IF;

  IF p_priest_id IS NOT NULL THEN
    -- Same pool the approve modal offers (getChurchPriests)
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = p_priest_id
        AND (p.role::text IN ('priest', 'church_admin', 'admin') OR COALESCE(p.is_priest, false))
        AND (p.assigned_church_id = v_apt.church_id OR p.church_id = v_apt.church_id)
    ) INTO v_priest_ok;

    IF NOT v_priest_ok THEN
      RAISE EXCEPTION 'The selected celebrant is not a priest of this parish' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.appointments
  SET status = 'approved',
      priest_id = p_priest_id,
      admin_feedback = v_feedback,
      updated_at = NOW()
  WHERE id = v_apt.id;

  INSERT INTO public.appointment_changes (
    appointment_id, church_id, action, reason, before_values, after_values, changed_by
  ) VALUES (
    v_apt.id,
    v_apt.church_id,
    'approve',
    v_feedback,
    jsonb_build_object('status', 'pending'),
    CASE WHEN p_priest_id IS NULL
         THEN jsonb_build_object('status', 'approved')
         ELSE jsonb_build_object('status', 'approved', 'priest_id', p_priest_id) END,
    v_actor_id
  );

  v_message := 'Your ' || v_apt.service_type || ' appointment has been approved!';

  -- The parishioner asked for a specific priest and someone else (or nobody yet) was approved
  IF v_apt.requested_priest_id IS NOT NULL AND p_priest_id IS DISTINCT FROM v_apt.requested_priest_id THEN
    SELECT 'Fr. ' || COALESCE(
             NULLIF(btrim(regexp_replace(btrim(COALESCE(full_name, '')), '^(rev(erend|\.)?\s+)?(fr\.?|father)\s+', '', 'i')), ''),
             'Clergy Member')
      INTO v_requested_name
    FROM public.profiles
    WHERE id = v_apt.requested_priest_id;

    SELECT 'Fr. ' || COALESCE(
             NULLIF(btrim(regexp_replace(btrim(COALESCE(full_name, '')), '^(rev(erend|\.)?\s+)?(fr\.?|father)\s+', '', 'i')), ''),
             'Clergy Member')
      INTO v_assigned_name
    FROM public.profiles
    WHERE id = p_priest_id;

    v_message := v_message
      || ' The priest you requested'
      || COALESCE(' (' || v_requested_name || ')', '')
      || ' could not be assigned'
      || CASE WHEN v_assigned_name IS NOT NULL
              THEN '; ' || v_assigned_name || ' will preside instead.'
              ELSE ', and the parish office will confirm the celebrant.' END;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    v_apt.user_id,
    'appointment_approved',
    'Appointment Approved',
    v_message,
    '/appointments'
  );

  IF p_priest_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      p_priest_id,
      'appointment',
      'New Sacramental Assignment',
      'You have been assigned as celebrant for a ' || v_apt.service_type
        || ' on ' || v_apt.appointment_date::text
        || ' at ' || to_char(v_apt.appointment_time::time, 'FMHH12:MI AM') || '.',
      '/appointments'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_appointment(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_appointment(UUID, UUID, TEXT) TO authenticated;
