-- ==============================================================================
-- MIGRATION 048: reschedule_appointment function
-- The parish office moves an approved appointment to a new date and time, and may
-- switch the presiding celebrant in the same save. The appointment stays approved
-- ('rescheduled' is never written as a status). The edit is recorded as ONE
-- appointment_changes row in the same transaction (see ADR 0001).
--
-- History row shape (read by the "Rescheduled from ..." notice and the change history):
--   action        = 'reschedule'
--   reason        = the office's reason
--   before_values = {"appointment_date": "YYYY-MM-DD", "appointment_time": "HH:MI:SS"}
--   after_values  = {"appointment_date": "YYYY-MM-DD", "appointment_time": "HH:MI:SS"}
--   When the celebrant changes in the same save, both objects ALSO carry
--   "priest_id" (old value may be null). No separate 'change_celebrant' row is written.
--   Date and time are always present, so the old date is always before_values.appointment_date.
--
-- "Today" is the UTC calendar date, the same notion the web app uses (new Date().toISOString()).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_appointment_id UUID,
  p_new_date DATE,
  p_new_time TIME,
  p_reason TEXT,
  p_new_priest_id UUID DEFAULT NULL
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
  v_old_priest_id UUID;
  v_final_priest_id UUID;
  v_priest_changed BOOLEAN;
  v_is_celebrant BOOLEAN;
  v_old_when TEXT;
  v_new_when TEXT;
  v_before JSONB;
  v_after JSONB;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'A reason is required to reschedule an appointment' USING ERRCODE = '22023';
  END IF;

  IF p_new_date IS NULL OR p_new_time IS NULL THEN
    RAISE EXCEPTION 'A new date and time are required' USING ERRCODE = '22023';
  END IF;

  IF p_new_date < (NOW() AT TIME ZONE 'UTC')::date THEN
    RAISE EXCEPTION 'An appointment cannot be rescheduled to a date in the past' USING ERRCODE = '22023';
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
    RAISE EXCEPTION 'Only the parish office can reschedule this appointment' USING ERRCODE = '42501';
  END IF;

  IF v_apt.status::text <> 'approved' THEN
    RAISE EXCEPTION 'Only approved appointments can be rescheduled' USING ERRCODE = '22023';
  END IF;

  v_old_priest_id := v_apt.priest_id;
  v_priest_changed := p_new_priest_id IS NOT NULL AND p_new_priest_id IS DISTINCT FROM v_old_priest_id;
  v_final_priest_id := CASE WHEN v_priest_changed THEN p_new_priest_id ELSE v_old_priest_id END;

  IF p_new_date = v_apt.appointment_date::date
     AND p_new_time = v_apt.appointment_time::time
     AND NOT v_priest_changed THEN
    RAISE EXCEPTION 'Choose a different date, time or celebrant to reschedule' USING ERRCODE = '22023';
  END IF;

  IF v_priest_changed THEN
    -- Same pool the approve flow offers (getChurchPriests).
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = p_new_priest_id
        AND (p.role::text IN ('priest', 'church_admin', 'admin') OR COALESCE(p.is_priest, false))
        AND (p.assigned_church_id = v_apt.church_id OR p.church_id = v_apt.church_id)
    ) INTO v_is_celebrant;

    IF NOT v_is_celebrant THEN
      RAISE EXCEPTION 'The selected celebrant is not a priest of this parish' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_before := jsonb_build_object(
    'appointment_date', v_apt.appointment_date::date,
    'appointment_time', v_apt.appointment_time::time
  );
  v_after := jsonb_build_object(
    'appointment_date', p_new_date,
    'appointment_time', p_new_time
  );
  IF v_priest_changed THEN
    v_before := v_before || jsonb_build_object('priest_id', v_old_priest_id);
    v_after := v_after || jsonb_build_object('priest_id', p_new_priest_id);
  END IF;

  UPDATE public.appointments
  SET appointment_date = p_new_date,
      appointment_time = p_new_time,
      priest_id = v_final_priest_id,
      updated_at = NOW()
  WHERE id = v_apt.id;

  INSERT INTO public.appointment_changes (
    appointment_id, church_id, action, reason, before_values, after_values, changed_by
  ) VALUES (
    v_apt.id, v_apt.church_id, 'reschedule', v_reason, v_before, v_after, v_actor_id
  );

  v_old_when := to_char(v_apt.appointment_date::date, 'FMMon DD, YYYY')
                || ' at ' || to_char(v_apt.appointment_time::time, 'FMHH12:MI AM');
  v_new_when := to_char(p_new_date, 'FMMon DD, YYYY')
                || ' at ' || to_char(p_new_time, 'FMHH12:MI AM');

  -- Parishioner: always told (old date, new date, reason)
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    v_apt.user_id,
    'appointment_rescheduled',
    'Appointment Rescheduled',
    'Your ' || v_apt.service_type || ' on ' || v_old_when || ' has been rescheduled to ' || v_new_when
      || '. Reason: ' || v_reason,
    '/appointments'
  );

  -- Celebrant after the save: told about the new schedule (assigned, when newly chosen).
  -- Anyone who is also the parishioner already got the message above.
  IF v_final_priest_id IS NOT NULL AND v_final_priest_id IS DISTINCT FROM v_apt.user_id THEN
    IF v_priest_changed THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        v_final_priest_id,
        'appointment',
        'New Sacramental Assignment',
        'You have been assigned as celebrant for a ' || v_apt.service_type || ' on ' || v_new_when
          || ' (rescheduled from ' || v_old_when || '). Reason: ' || v_reason,
        '/appointments'
      );
    ELSE
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        v_final_priest_id,
        'appointment_rescheduled',
        'Appointment Rescheduled',
        'The ' || v_apt.service_type || ' on ' || v_old_when || ' that you are to preside at has been rescheduled to '
          || v_new_when || '. Reason: ' || v_reason,
        '/appointments'
      );
    END IF;
  END IF;

  -- Previous celebrant, when replaced in the same save: removed
  IF v_priest_changed
     AND v_old_priest_id IS NOT NULL
     AND v_old_priest_id IS DISTINCT FROM v_apt.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_old_priest_id,
      'appointment',
      'Celebrant Assignment Removed',
      'The ' || v_apt.service_type || ' on ' || v_old_when || ' was rescheduled to ' || v_new_when
        || ' and you are no longer the celebrant. Reason: ' || v_reason,
      '/appointments'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_appointment(UUID, DATE, TIME, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(UUID, DATE, TIME, TEXT, UUID) TO authenticated;
