-- ==============================================================================
-- MIGRATION 081: In-app notification for new appointment requests
-- ==============================================================================
-- When a new appointment is requested (status = 'pending'), notify all church admins
-- and volunteers for that church. Running as a database trigger with SECURITY DEFINER
-- avoids client-side RLS restrictions on cross-user notification insertion.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.notify_admins_of_new_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name text;
  v_admin_id uuid;
BEGIN
  -- Only notify on pending appointments
  IF NEW.status = 'pending' THEN
    -- Look up the requester's name
    SELECT full_name INTO v_user_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    -- Send notification to all church admins and volunteers of the church
    FOR v_admin_id IN
      SELECT DISTINCT id FROM public.profiles
      WHERE (church_id = NEW.church_id OR assigned_church_id = NEW.church_id)
        AND role IN ('church_admin', 'volunteer')
        AND (deleted_at IS NULL)
        AND id <> NEW.user_id
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
      VALUES (
        v_admin_id,
        'appointment_created',
        'New Appointment Request',
        COALESCE(NULLIF(btrim(v_user_name), ''), 'A parishioner') || ' requested a ' || NEW.service_type || ' appointment',
        '/appointments',
        false
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_admins_of_new_appointment ON public.appointments;
CREATE TRIGGER tr_notify_admins_of_new_appointment
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_of_new_appointment();

COMMENT ON FUNCTION public.notify_admins_of_new_appointment() IS 'Sends an in-app notification to church admins and volunteers when a new pending appointment is created.';
