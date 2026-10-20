-- ==============================================================================
-- MIGRATION 043: Fix Church Announcements RLS for Verified Active Churches & Priests
-- ==============================================================================

-- 1. Fix Public Read Policy
-- Allow SELECT for churches that are 'active' or 'verified_active'
DROP POLICY IF EXISTS "Public can read church announcements" ON public.church_announcements;

CREATE POLICY "Public can read church announcements"
ON public.church_announcements
FOR SELECT
USING (
    church_id IN (
        SELECT id FROM public.churches WHERE status IN ('active', 'verified_active')
    )
);

-- 2. Fix Church Staff Management Policy
-- Allow priests assigned to the church, alongside super_admin, admin, church_admin, and volunteer
DROP POLICY IF EXISTS "Church staff can manage their church announcements" ON public.church_announcements;

CREATE POLICY "Church staff can manage their church announcements"
ON public.church_announcements
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (
            profiles.role = 'super_admin'
            OR profiles.role = 'admin'
            OR (
                (profiles.role = 'church_admin' OR profiles.role = 'volunteer' OR profiles.role = 'priest')
                AND COALESCE(profiles.assigned_church_id, profiles.church_id) = church_announcements.church_id
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
            OR profiles.role = 'admin'
            OR (
                (profiles.role = 'church_admin' OR profiles.role = 'volunteer' OR profiles.role = 'priest')
                AND COALESCE(profiles.assigned_church_id, profiles.church_id) = church_announcements.church_id
            )
        )
    )
);
