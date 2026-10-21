-- ==============================================================================
-- MIGRATION 051: restore_appointment function
-- The parish office returns a Cancelled or Celebrated appointment to approved after a
-- mistake, with a required reason. The status change and the Appointment Change row are
-- written in the same transaction (see ADR 0001).
--
-- History row shape (read by the change history):
--   action        = 'restore'
--   reason        = the office's reason
--   before_values = {"status": "cancelled"}  or  {"status": "completed"}   (completed = Celebrated)
--   after_values  = {"status": "approved"}
--
-- Restoring a CANCELLED appointment clears appointments.cancellation_reason and notifies the
-- parishioner and the current celebrant. Restoring a CELEBRATED appointment notifies no one,
-- matching how marking it celebrated notified no one.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.restore_appointment(
  p_appointment_id UUID,
  p_reason TEXT
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
  v_reason TEXT := btrim(COALESCE(p_reason, ''));
  v_old_status TEXT;
  v_when TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'A reason is required to restore an appointment' USING ERRCODE = '22023';
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
    RAISE EXCEPTION 'Only the parish office can restore this appointment' USING ERRCODE = '42501';
  END IF;

  v_old_status := v_apt.status::text;

  IF v_old_status NOT IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'Only cancelled or celebrated appointments can be restored' USING ERRCODE = '22023';
  END IF;

  UPDATE public.appointments
  SET status = 'approved',
      cancellation_reason = CASE WHEN v_old_status = 'cancelled' THEN NULL ELSE cancellation_reason END,
      updated_at = NOW()
  WHERE id = v_apt.id;

  INSERT INTO public.appointment_changes (
    appointment_id, church_id, action, reason, before_values, after_values, changed_by
  ) VALUES (
    v_apt.id,
    v_apt.church_id,
    'restore',
    v_reason,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', 'approved'),
    v_actor_id
  );

  -- Restoring a Celebrated appointment notifies no one
  IF v_old_status = 'cancelled' THEN
    v_when := to_char(v_apt.appointment_date::date, 'FMMon DD, YYYY')
              || ' at ' || to_char(v_apt.appointment_time::time, 'FMHH12:MI AM');

    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_apt.user_id,
      'appointment',
      'Appointment Restored',
      'Your ' || v_apt.service_type || ' on ' || v_when || ' has been restored and is approved again. Reason: ' || v_reason,
      '/appointments'
    );

    IF v_apt.priest_id IS NOT NULL AND v_apt.priest_id IS DISTINCT FROM v_apt.user_id THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        v_apt.priest_id,
        'appointment',
        'Appointment Restored',
        'The ' || v_apt.service_type || ' on ' || v_when || ' that you are to preside at has been restored. Reason: ' || v_reason,
        '/appointments'
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_appointment(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_appointment(UUID, TEXT) TO authenticated;
