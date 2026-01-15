-- Migration: Add volunteer access to appointments and churches

-- 1. Update RLS for Churches
-- Allow volunteer to update their assigned church (in addition to church_admin)
-- Note: We replace the policy from 010
DROP POLICY IF EXISTS "Admins can update their church" ON public.churches;

CREATE POLICY "Admins and volunteers can update their church"
ON public.churches FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (
      role = 'super_admin'
      OR ((role = 'church_admin' OR role = 'volunteer') AND assigned_church_id = churches.id)
      OR (role = 'admin' AND church_id = churches.id)
    )
  )
);

-- 2. Update RLS for Appointments
-- Allow volunteer to view appointments for their assigned church
DROP POLICY IF EXISTS "Church admins can view church appointments" ON public.appointments;
-- Also drop the old 008 global policy if it exists (it was generic)
DROP POLICY IF EXISTS "Admins can view all appointments" ON public.appointments;

CREATE POLICY "Church staff can view church appointments"
ON public.appointments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (
      role = 'super_admin'
      OR ((role = 'church_admin' OR role = 'volunteer') AND assigned_church_id = appointments.church_id)
      OR (role = 'admin' AND church_id = appointments.church_id)
    )
  )
);

-- Allow volunteer to update appointments (approve/reject)
DROP POLICY IF EXISTS "Church admins can update church appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admins can update appointments" ON public.appointments;

CREATE POLICY "Church staff can update church appointments"
ON public.appointments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (
      role = 'super_admin'
      OR ((role = 'church_admin' OR role = 'volunteer') AND assigned_church_id = appointments.church_id)
      OR (role = 'admin' AND church_id = appointments.church_id)
    )
  )
);
