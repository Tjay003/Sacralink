-- =========================================================
-- MIGRATION 026: Strict Manual Parish Verification & Applications
-- =========================================================

-- 1. Update churches status constraint to include 'unverified' and 'verified_active'
ALTER TABLE public.churches DROP CONSTRAINT IF EXISTS churches_status_check;
ALTER TABLE public.churches ADD CONSTRAINT churches_status_check 
  CHECK (status IN ('active', 'inactive', 'unverified', 'verified_active'));

-- 2. Create parish_applications table
CREATE TABLE IF NOT EXISTS public.parish_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    parish_name TEXT NOT NULL,
    address TEXT NOT NULL,
    contact_number TEXT,
    email TEXT,
    description TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    gcash_number TEXT,
    maya_number TEXT,
    celebret_url TEXT NOT NULL,
    decree_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'verified_active', 'rejected')),
    checklist JSONB DEFAULT '{"rectory_call": false, "celebret_verified": false, "merchant_entity_verified": false, "notes": ""}'::jsonb,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_parish_applications_status ON public.parish_applications(status);
CREATE INDEX IF NOT EXISTS idx_parish_applications_applicant ON public.parish_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_parish_applications_created ON public.parish_applications(created_at DESC);

-- 4. Enable Row Level Security
ALTER TABLE public.parish_applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Applicants can view own applications" ON public.parish_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.parish_applications;
DROP POLICY IF EXISTS "Users can submit parish application" ON public.parish_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.parish_applications;
DROP POLICY IF EXISTS "Admins can delete applications" ON public.parish_applications;

-- Policy: Applicants can view their own application
CREATE POLICY "Applicants can view own applications"
ON public.parish_applications FOR SELECT
USING (
  auth.uid() = applicant_id
);

-- Policy: Super Admins & Admins can view all applications
CREATE POLICY "Admins can view all applications"
ON public.parish_applications FOR SELECT
USING (
  public.get_current_user_role() IN ('admin', 'super_admin')
);

-- Policy: Authenticated users can insert their own application
CREATE POLICY "Users can submit parish application"
ON public.parish_applications FOR INSERT
WITH CHECK (
  auth.uid() = applicant_id
);

-- Policy: Super Admins & Admins can update applications (review, approve, reject)
CREATE POLICY "Admins can update applications"
ON public.parish_applications FOR UPDATE
USING (
  public.get_current_user_role() IN ('admin', 'super_admin')
);

-- Policy: Super Admins & Admins can delete applications
CREATE POLICY "Admins can delete applications"
ON public.parish_applications FOR DELETE
USING (
  public.get_current_user_role() IN ('admin', 'super_admin')
);
