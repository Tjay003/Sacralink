-- Migration: 037_limit_concurrent_pending_appointments.sql
-- Enforces a maximum limit of 3 concurrent pending sacrament appointments per user.

CREATE OR REPLACE FUNCTION public.check_pending_appointments_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.appointments WHERE user_id = NEW.user_id AND status = 'pending') >= 3 THEN
    RAISE EXCEPTION 'You have reached the limit of 3 pending sacrament appointments. Please await confirmation before submitting additional requests.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_pending_appointments_limit ON public.appointments;

CREATE TRIGGER trg_check_pending_appointments_limit
BEFORE INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.check_pending_appointments_limit();
