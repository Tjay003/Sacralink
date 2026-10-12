-- Migration 034: Secure Donations Super Admin Blindspot
-- Enforces parish financial privacy by completely eliminating super_admin access to donations
-- and donation proofs in Row-Level Security (RLS).
--
-- Access rules:
-- 1. Donors: Can view and insert their own donation records (auth.uid() = user_id) as long as they are not super_admin.
-- 2. Parish Staff (church_admin, admin): Can only view and update donations for their assigned parish (church_id = public.get_current_user_church_id()).
-- 3. Super Admin: Strictly receives 0 rows across public.donations and storage.objects for donation-proofs.

-- Ensure helper functions are available and up to date
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_church_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(assigned_church_id, church_id) FROM public.profiles WHERE id = auth.uid();
$$;

-- ========================================================
-- 1. SECURE ROW LEVEL SECURITY ON public.donations
-- ========================================================

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies that permit access to donations
DROP POLICY IF EXISTS "Users can view own donations" ON public.donations;
DROP POLICY IF EXISTS "Users can create donations" ON public.donations;
DROP POLICY IF EXISTS "Users can create own donations" ON public.donations;
DROP POLICY IF EXISTS "Admins can view church donations" ON public.donations;
DROP POLICY IF EXISTS "Church admins can view church donations" ON public.donations;
DROP POLICY IF EXISTS "Parish staff can view church donations" ON public.donations;
DROP POLICY IF EXISTS "Donors can view own donations" ON public.donations;
DROP POLICY IF EXISTS "Donors can create donations" ON public.donations;
DROP POLICY IF EXISTS "Admins can update church donations" ON public.donations;
DROP POLICY IF EXISTS "Parish staff can update church donations" ON public.donations;
DROP POLICY IF EXISTS "Super admins can view all donations" ON public.donations;
DROP POLICY IF EXISTS "Super admins can update all donations" ON public.donations;

-- Policy 1: Donors can view only their own donations (super_admin strictly excluded)
CREATE POLICY "Donors can view own donations"
ON public.donations FOR SELECT
USING (
  auth.uid() = user_id
  AND public.get_current_user_role() != 'super_admin'
);

-- Policy 2: Parish staff (church_admin, admin) can view donations belonging to their assigned parish
-- super_admin receives 0 rows
CREATE POLICY "Parish staff can view church donations"
ON public.donations FOR SELECT
USING (
  public.get_current_user_role() IN ('church_admin', 'admin')
  AND public.get_current_user_church_id() IS NOT NULL
  AND church_id = public.get_current_user_church_id()
);

-- Policy 3: Donors can create their own donations (super_admin strictly excluded)
CREATE POLICY "Donors can create donations"
ON public.donations FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.get_current_user_role() != 'super_admin'
);

-- Policy 4: Parish staff (church_admin, admin) can update donations for their assigned parish (e.g. verify/reject)
CREATE POLICY "Parish staff can update church donations"
ON public.donations FOR UPDATE
USING (
  public.get_current_user_role() IN ('church_admin', 'admin')
  AND public.get_current_user_church_id() IS NOT NULL
  AND church_id = public.get_current_user_church_id()
)
WITH CHECK (
  public.get_current_user_role() IN ('church_admin', 'admin')
  AND public.get_current_user_church_id() IS NOT NULL
  AND church_id = public.get_current_user_church_id()
);

-- ========================================================
-- 2. SECURE STORAGE RLS ON donation-proofs BUCKET
-- ========================================================

-- Ensure donation-proofs bucket exists and is private
INSERT INTO storage.buckets (id, name, public)
VALUES ('donation-proofs', 'donation-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop all existing storage policies for donation-proofs
DROP POLICY IF EXISTS "Donors can upload donation proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own donation proof" ON storage.objects;
DROP POLICY IF EXISTS "Donors can view own donation proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own donation proof" ON storage.objects;
DROP POLICY IF EXISTS "Parish staff can view church donation proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view donation proofs" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can view donation proofs" ON storage.objects;
DROP POLICY IF EXISTS "Donors can delete own donation proofs" ON storage.objects;

-- Storage Policy 1: Donors can upload donation proofs to their own user folder (super_admin strictly excluded)
CREATE POLICY "Donors can upload donation proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'donation-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.get_current_user_role() != 'super_admin'
);

-- Storage Policy 2: Donors can view their own uploaded donation proofs (super_admin strictly excluded)
CREATE POLICY "Donors can view own donation proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'donation-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.get_current_user_role() != 'super_admin'
);

-- Storage Policy 3: Parish staff (church_admin, admin) can view donation proofs for their assigned church
-- super_admin is strictly excluded
CREATE POLICY "Parish staff can view church donation proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'donation-proofs'
  AND public.get_current_user_role() IN ('church_admin', 'admin')
  AND public.get_current_user_church_id() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.donations d
    WHERE d.church_id = public.get_current_user_church_id()
      AND (
        d.user_id::text = (storage.foldername(name))[1]
        OR d.proof_url LIKE '%' || name || '%'
      )
  )
);

-- Storage Policy 4: Donors can delete their own unverified donation proofs if needed (super_admin strictly excluded)
CREATE POLICY "Donors can delete own donation proofs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'donation-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.get_current_user_role() != 'super_admin'
);
