-- ==============================================================================
-- MIGRATION 047: change_appointment_celebrant function
-- The parish office assigns or changes the presiding celebrant of an approved
-- appointment. The change is recorded as an appointment_changes row in the same
-- transaction (see ADR 0001). Only the new and the removed celebrant are notified;
-- the parishioner is not re-notified.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.change_appointment_celebrant(
  p_appointment_id UUID,
  p_new_priest_id UUID,
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
  v_new_is_celebrant BOOLEAN;
  v_old_priest_id UUID;
  v_when TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'A reason is required to change the celebrant' USING ERRCODE = '22023';
  END IF;

  IF p_new_priest_id IS NULL THEN
    RAISE EXCEPTION 'A new celebrant is required' USING ERRCODE = '22023';
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
    RAISE EXCEPTION 'Only the parish office can change the celebrant' USING ERRCODE = '42501';
  END IF;

  IF v_apt.status::text <> 'approved' THEN
    RAISE EXCEPTION 'Only approved appointments can have their celebrant changed' USING ERRCODE = '22023';
  END IF;

  -- Same pool the approve flow offers (getChurchPriests): priests, church admins, admins
  -- and clergy flagged is_priest who belong to this parish.
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_new_priest_id
      AND (p.role::text IN ('priest', 'church_admin', 'admin') OR COALESCE(p.is_priest, false))
      AND (p.assigned_church_id = v_apt.church_id OR p.church_id = v_apt.church_id)
  ) INTO v_new_is_celebrant;

  IF NOT v_new_is_celebrant THEN
    RAISE EXCEPTION 'The selected celebrant is not a priest of this parish' USING ERRCODE = '22023';
  END IF;

  v_old_priest_id := v_apt.priest_id;

  UPDATE public.appointments
  SET priest_id = p_new_priest_id,
      updated_at = NOW()
  WHERE id = v_apt.id;

  INSERT INTO public.appointment_changes (
    appointment_id, church_id, action, reason, before_values, after_values, changed_by
  ) VALUES (
    v_apt.id,
    v_apt.church_id,
    'change_celebrant',
    v_reason,
    jsonb_build_object('priest_id', v_old_priest_id),
    jsonb_build_object('priest_id', p_new_priest_id),
    v_actor_id
  );

  v_when := to_char(v_apt.appointment_date::date, 'FMMon DD, YYYY')
            || ' at ' || to_char(v_apt.appointment_time::time, 'FMHH12:MI AM');

  -- New celebrant: assigned (skipped when re-selecting the same person)
  IF p_new_priest_id IS DISTINCT FROM v_old_priest_id THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      p_new_priest_id,
      'appointment',
      'New Sacramental Assignment',
      'You have been assigned as celebrant for a ' || v_apt.service_type || ' on ' || v_when || '.',
      '/appointments'
    );

    -- Old celebrant: removed
    IF v_old_priest_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        v_old_priest_id,
        'appointment',
        'Celebrant Assignment Removed',
        'You are no longer the celebrant for the ' || v_apt.service_type || ' on ' || v_when || '. Reason: ' || v_reason,
        '/appointments'
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.change_appointment_celebrant(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_appointment_celebrant(UUID, UUID, TEXT) TO authenticated;
