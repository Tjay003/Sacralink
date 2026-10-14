-- ==============================================================================
-- MIGRATION 038: Fix Church Update RLS and Storage Policies for QR Codes
-- ==============================================================================

-- 1. Ensure QR columns exist on public.churches table
ALTER TABLE public.churches
ADD COLUMN IF NOT EXISTS gcash_qr_url text,
ADD COLUMN IF NOT EXISTS maya_qr_url text;

-- 2. Fix UPDATE policy on public.churches
-- Previously, role 'admin' checked profiles.church_id = churches.id, which blocked
-- admins created with modern assigned_church_id. Also adds support for 'priest' role.
DROP POLICY IF EXISTS "Admins and volunteers can update their church" ON public.churches;
DROP POLICY IF EXISTS "Admins, priests, and volunteers can update their church" ON public.churches;

CREATE POLICY "Admins, priests, and volunteers can update their church"
ON public.churches FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'super_admin'
      OR (
        profiles.role IN ('admin', 'church_admin', 'volunteer', 'priest')
        AND COALESCE(profiles.assigned_church_id, profiles.church_id) = churches.id
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'super_admin'
      OR (
        profiles.role IN ('admin', 'church_admin', 'volunteer', 'priest')
        AND COALESCE(profiles.assigned_church_id, profiles.church_id) = churches.id
      )
    )
  )
);

-- 3. Ensure Storage Buckets exist and are public
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('church-images', 'church-images', true),
  ('donation-qr', 'donation-qr', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Storage Policies on storage.objects for church-images & donation-qr
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated staff to upload (INSERT) images into church-images and donation-qr
DROP POLICY IF EXISTS "Parish staff can upload church images" ON storage.objects;
CREATE POLICY "Parish staff can upload church images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('church-images', 'donation-qr')
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'church_admin', 'volunteer', 'priest')
  )
);

-- Allow authenticated staff to update/replace (UPDATE) images in church-images and donation-qr
DROP POLICY IF EXISTS "Parish staff can update church images" ON storage.objects;
CREATE POLICY "Parish staff can update church images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('church-images', 'donation-qr')
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'church_admin', 'volunteer', 'priest')
  )
);

-- Allow authenticated staff to delete (DELETE) images in church-images and donation-qr
DROP POLICY IF EXISTS "Parish staff can delete church images" ON storage.objects;
CREATE POLICY "Parish staff can delete church images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id IN ('church-images', 'donation-qr')
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'church_admin', 'volunteer', 'priest')
  )
);

-- Allow public read access (SELECT) for church-images and donation-qr
DROP POLICY IF EXISTS "Public can view church images" ON storage.objects;
CREATE POLICY "Public can view church images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('church-images', 'donation-qr'));
