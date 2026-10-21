-- ==============================================================================
-- MIGRATION 060: Volunteers see only their own appointments and cannot edit
-- parish details or donation QR codes
-- ==============================================================================
-- Volunteers book and view sacrament appointments like a parishioner. They keep
-- the "Users can view their own appointments" SELECT policy but lose the
-- parish-wide read access, so the rule holds even for direct API calls.
-- Volunteers also cannot UPDATE the churches row or write to the donation-qr
-- bucket (livestream control stays available through update_church_livestream).
-- Idempotent: safe to run more than once.
-- ==============================================================================

-- 1. Appointments: parish-wide SELECT for church_admin, admin and super_admin only
DROP POLICY IF EXISTS "Church staff can view church appointments" ON public.appointments;

CREATE POLICY "Church staff can view church appointments"
ON public.appointments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'super_admin'
      OR (profiles.role = 'church_admin' AND profiles.assigned_church_id = appointments.church_id)
      OR (profiles.role = 'admin' AND profiles.church_id = appointments.church_id)
    )
  )
);

-- 2. Churches: no direct UPDATE for volunteers
DROP POLICY IF EXISTS "Admins and volunteers can update their church" ON public.churches;
DROP POLICY IF EXISTS "Admins, priests, and volunteers can update their church" ON public.churches;
DROP POLICY IF EXISTS "Admins and priests can update their church" ON public.churches;
DROP POLICY IF EXISTS "Admins can update own church" ON public.churches;
DROP POLICY IF EXISTS "Admins can update their church" ON public.churches;

CREATE POLICY "Admins can update their church"
ON public.churches FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'super_admin'
      OR (
        profiles.role IN ('admin', 'church_admin')
        AND COALESCE(profiles.assigned_church_id, profiles.church_id) = churches.id
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'super_admin'
      OR (
        profiles.role IN ('admin', 'church_admin')
        AND COALESCE(profiles.assigned_church_id, profiles.church_id) = churches.id
      )
    )
  )
);

-- 3. donation-qr bucket: no volunteer writes
DROP POLICY IF EXISTS "Admins can upload donation qr" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update donation qr" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete donation qr" ON storage.objects;

CREATE POLICY "Admins can upload donation qr"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'donation-qr'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'church_admin', 'priest')
  )
);

CREATE POLICY "Admins can update donation qr"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'donation-qr'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'church_admin', 'priest')
  )
);

CREATE POLICY "Admins can delete donation qr"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'donation-qr'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'church_admin', 'priest')
  )
);
