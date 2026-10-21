-- ==============================================================================
-- MIGRATION 050: mark_appointment_celebrated function
-- Marks an approved appointment Celebrated (stored as status 'completed'), with an optional
-- note, and records the Appointment Change in the same transaction (see ADR 0001).
-- Nobody is notified. Callable by the parish office (any appointment in its parish) or by the
-- appointment's own celebrant.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.mark_appointment_celebrated(
  p_appointment_id UUID,
  p_note TEXT DEFAULT NULL
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
  v_note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_is_office BOOLEAN;
  v_is_celebrant BOOLEAN;
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

  v_is_office := v_actor_role IN ('super_admin', 'admin', 'church_admin')
                 AND (v_actor_role = 'super_admin' OR v_actor_church IS NOT DISTINCT FROM v_apt.church_id);
  v_is_celebrant := v_apt.priest_id IS NOT NULL AND v_apt.priest_id = v_actor_id;

  IF NOT (COALESCE(v_is_office, false) OR v_is_celebrant) THEN
    RAISE EXCEPTION 'Only the parish office or the celebrant of this appointment can mark it celebrated'
      USING ERRCODE = '42501';
  END IF;

  IF v_apt.status::text <> 'approved' THEN
    RAISE EXCEPTION 'Only approved appointments can be marked celebrated' USING ERRCODE = '22023';
  END IF;

  -- The office may mark at any time. A celebrant (who is not also office staff of the parish) may
  -- only mark an appointment that has started. Appointment date/time carry no time zone, so the
  -- check is deliberately lenient: it rejects only an appointment that has not started anywhere on
  -- earth (UTC now + 14 hours, the furthest-ahead offset). The web UI applies the precise local rule.
  IF NOT COALESCE(v_is_office, false)
     AND (v_apt.appointment_date::date + v_apt.appointment_time::time)
         > ((NOW() AT TIME ZONE 'UTC') + INTERVAL '14 hours') THEN
    RAISE EXCEPTION 'This appointment has not started yet' USING ERRCODE = '22023';
  END IF;

  UPDATE public.appointments
  SET status = 'completed',
      updated_at = NOW()
  WHERE id = v_apt.id;

  INSERT INTO public.appointment_changes (
    appointment_id, church_id, action, reason, before_values, after_values, changed_by
  ) VALUES (
    v_apt.id,
    v_apt.church_id,
    'mark_celebrated',
    v_note,
    jsonb_build_object('status', v_apt.status::text),
    jsonb_build_object('status', 'completed'),
    v_actor_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_appointment_celebrated(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_appointment_celebrated(UUID, TEXT) TO authenticated;
