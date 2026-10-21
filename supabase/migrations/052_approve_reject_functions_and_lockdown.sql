-- ==============================================================================
-- MIGRATION 052: approve_appointment / reject_appointment + lock down direct updates
-- Approving and rejecting a pending request move to database functions so that every
-- write to an appointment by church staff goes through a function that records an
-- Appointment Change row in the same transaction (see ADR 0001). The appointments
-- UPDATE policies are then reduced to: parishioners on their own pending requests
-- (unchanged) and super admin (system-wide admin tooling).
--
-- History rows written here (read by the change history):
--   approve: before {"status":"pending"}
--            after  {"status":"approved"} plus "priest_id" when a celebrant was assigned
--            reason = the office note (admin_feedback), if any
--   reject:  before {"status":"pending"}, after {"status":"rejected"}
--            reason = the office note (admin_feedback), if any
--
-- Notifications are exactly those the web client used to create after the update:
--   approve: parishioner "Appointment Approved" (type appointment_approved);
--            assigned celebrant "New Sacramental Assignment" (type appointment)
--   reject:  parishioner "Appointment Rejected" (type appointment_rejected)
-- ==============================================================================

-- 1. Allow the two new actions in the change history (existing values kept)
ALTER TABLE public.appointment_changes DROP CONSTRAINT IF EXISTS appointment_changes_action_check;
ALTER TABLE public.appointment_changes ADD CONSTRAINT appointment_changes_action_check
  CHECK (action IN ('reschedule', 'change_celebrant', 'cancel', 'mark_celebrated', 'restore', 'approve', 'reject'));

-- 2. approve_appointment
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

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    v_apt.user_id,
    'appointment_approved',
    'Appointment Approved',
    'Your ' || v_apt.service_type || ' appointment has been approved!',
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

-- 3. reject_appointment
CREATE OR REPLACE FUNCTION public.reject_appointment(
  p_appointment_id UUID,
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
    RAISE EXCEPTION 'Only the parish office can reject this appointment' USING ERRCODE = '42501';
  END IF;

  IF v_apt.status::text <> 'pending' THEN
    RAISE EXCEPTION 'Only pending appointments can be rejected' USING ERRCODE = '22023';
  END IF;

  -- The previous client-side reject only changed the status; the office note is written only when one is given
  UPDATE public.appointments
  SET status = 'rejected',
      admin_feedback = COALESCE(v_feedback, admin_feedback),
      updated_at = NOW()
  WHERE id = v_apt.id;

  INSERT INTO public.appointment_changes (
    appointment_id, church_id, action, reason, before_values, after_values, changed_by
  ) VALUES (
    v_apt.id,
    v_apt.church_id,
    'reject',
    v_feedback,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'rejected'),
    v_actor_id
  );

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    v_apt.user_id,
    'appointment_rejected',
    'Appointment Rejected',
    'Your ' || v_apt.service_type || ' appointment has been rejected.',
    '/appointments'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reject_appointment(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_appointment(UUID, TEXT) TO authenticated;

-- 4. Lock down direct UPDATE on public.appointments
--    Every staff UPDATE policy that has ever existed is dropped (the names differ between
--    environments because of the order earlier migrations ran). "Admins can manage church
--    appointments" was a FOR ALL policy, so it also granted admins UPDATE.
DROP POLICY IF EXISTS "Admins can manage church appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admins can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Church admins can update church appointments" ON public.appointments;
DROP POLICY IF EXISTS "Church staff can update church appointments" ON public.appointments;
DROP POLICY IF EXISTS "Priests can update their assigned appointments" ON public.appointments;

--    Super admin keeps direct UPDATE for system-wide admin tooling.
DROP POLICY IF EXISTS "Super admin can update appointments" ON public.appointments;
CREATE POLICY "Super admin can update appointments"
ON public.appointments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);

--    Parishioners keep exactly today's direct write: their own requests while still pending.
--    (Migrations 001 and 004 created the same rule under two names; keep a single copy.)
DROP POLICY IF EXISTS "Users can update own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can update own pending appointments" ON public.appointments;
CREATE POLICY "Users can update own pending appointments"
ON public.appointments FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');
