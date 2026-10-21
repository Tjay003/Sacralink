-- ==============================================================================
-- MIGRATION 046: Appointment Change history + cancel_appointment function
-- Every edit to an approved appointment is recorded as one appointment_changes row,
-- written in the same transaction as the edit itself (see ADR 0001).
-- ==============================================================================

-- 1. Make sure the status column accepts every lifecycle value (the original
--    CHECK constraint did not allow 'cancelled' or 'rescheduled').
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'rescheduled', 'completed', 'cancelled'));

-- 2. Latest cancellation reason, readable by the parishioner who owns the appointment.
--    (The change history itself is office/celebrant only, so the reason is copied here.)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 3. Appointment Change history table
CREATE TABLE IF NOT EXISTS public.appointment_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('reschedule', 'change_celebrant', 'cancel', 'mark_celebrated', 'restore')),
  reason TEXT,
  before_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_changes_appointment_id
  ON public.appointment_changes(appointment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointment_changes_church_id
  ON public.appointment_changes(church_id);

ALTER TABLE public.appointment_changes ENABLE ROW LEVEL SECURITY;

-- Rows are written only by SECURITY DEFINER functions, never directly.
REVOKE ALL ON public.appointment_changes FROM anon, authenticated;
GRANT SELECT ON public.appointment_changes TO authenticated;

DROP POLICY IF EXISTS "Office and celebrant can view appointment changes" ON public.appointment_changes;
CREATE POLICY "Office and celebrant can view appointment changes"
ON public.appointment_changes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'super_admin'
      OR (
        profiles.role IN ('admin', 'church_admin')
        AND COALESCE(profiles.assigned_church_id, profiles.church_id) = appointment_changes.church_id
      )
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.appointments
    WHERE appointments.id = appointment_changes.appointment_id
    AND appointments.priest_id = auth.uid()
  )
);

-- 4. Cancel an approved appointment (office only), recording the change and
--    notifying the parishioner and the current celebrant atomically.
CREATE OR REPLACE FUNCTION public.cancel_appointment(
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
  v_when TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'A reason is required to cancel an appointment' USING ERRCODE = '22023';
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
    RAISE EXCEPTION 'Only the parish office can cancel this appointment' USING ERRCODE = '42501';
  END IF;

  IF v_apt.status::text <> 'approved' THEN
    RAISE EXCEPTION 'Only approved appointments can be cancelled' USING ERRCODE = '22023';
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled',
      cancellation_reason = v_reason,
      updated_at = NOW()
  WHERE id = v_apt.id;

  INSERT INTO public.appointment_changes (
    appointment_id, church_id, action, reason, before_values, after_values, changed_by
  ) VALUES (
    v_apt.id,
    v_apt.church_id,
    'cancel',
    v_reason,
    jsonb_build_object('status', v_apt.status::text),
    jsonb_build_object('status', 'cancelled'),
    v_actor_id
  );

  v_when := to_char(v_apt.appointment_date::date, 'FMMon DD, YYYY')
            || ' at ' || to_char(v_apt.appointment_time::time, 'FMHH12:MI AM');

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    v_apt.user_id,
    'appointment_cancelled',
    'Appointment Cancelled',
    'Your ' || v_apt.service_type || ' on ' || v_when || ' has been cancelled. Reason: ' || v_reason,
    '/appointments'
  );

  IF v_apt.priest_id IS NOT NULL AND v_apt.priest_id IS DISTINCT FROM v_apt.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_apt.priest_id,
      'appointment_cancelled',
      'Appointment Cancelled',
      'The ' || v_apt.service_type || ' on ' || v_when || ' that you were to preside at has been cancelled. Reason: ' || v_reason,
      '/appointments'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_appointment(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(UUID, TEXT) TO authenticated;
