-- Migration: Add church_admin role and assigned_church_id to profiles
-- Also updates RLS for churches and appointments

-- 1. Add 'church_admin' to user_role enum safely
DO $$
BEGIN
    ALTER TYPE public.user_role ADD VALUE 'church_admin';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add assigned_church_id to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS assigned_church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_assigned_church_id ON public.profiles(assigned_church_id);

-- 3. Update RLS for Churches
-- Allow church_admin to update their assigned church
DROP POLICY IF EXISTS "Admins can update their church" ON public.churches;

CREATE POLICY "Admins can update their church"
ON public.churches FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (
      role = 'super_admin'
      OR (role = 'church_admin' AND assigned_church_id = churches.id)
      OR (role = 'admin' AND church_id = churches.id) -- Keep legacy compatibility for now
    )
  )
);

-- 4. Update RLS for Appointments
-- Allow church_admin to view appointments for their assigned church
DROP POLICY IF EXISTS "Church admins can view church appointments" ON public.appointments;

CREATE POLICY "Church admins can view church appointments"
ON public.appointments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (
      role = 'super_admin'
      OR (role = 'church_admin' AND assigned_church_id = appointments.church_id)
      OR (role = 'admin' AND church_id = appointments.church_id) -- Keep legacy compatibility
    )
  )
);

-- Allow church_admin to update appointments (approve/reject)
DROP POLICY IF EXISTS "Church admins can update church appointments" ON public.appointments;

CREATE POLICY "Church admins can update church appointments"
ON public.appointments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (
      role = 'super_admin'
      OR (role = 'church_admin' AND assigned_church_id = appointments.church_id)
      OR (role = 'admin' AND church_id = appointments.church_id) -- Keep legacy compatibility
    )
  )
);
