-- ==============================================================================
-- MIGRATION 045: Add target_audience to church_announcements
-- Enables targeting announcements to 'everyone' (public) or 'parishioners' (church members)
-- ==============================================================================

ALTER TABLE public.church_announcements 
ADD COLUMN IF NOT EXISTS target_audience TEXT NOT NULL DEFAULT 'everyone' 
CHECK (target_audience IN ('everyone', 'parishioners'));

COMMENT ON COLUMN public.church_announcements.target_audience IS 'Target audience for the announcement: everyone or parishioners';
