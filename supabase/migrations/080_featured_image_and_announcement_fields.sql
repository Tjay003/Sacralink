-- ==============================================================================
-- MIGRATION 080: Add featured_image_url to churches and category/scheduled_at to church_announcements
-- ==============================================================================

-- 1. Add featured_image_url to churches
ALTER TABLE public.churches
ADD COLUMN IF NOT EXISTS featured_image_url TEXT;

COMMENT ON COLUMN public.churches.featured_image_url IS 'Optional hero/featured display image URL for the church.';

-- 2. Add category and scheduled_at to church_announcements
ALTER TABLE public.church_announcements
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general',
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'church_announcements_category_check'
    ) THEN
        ALTER TABLE public.church_announcements
        ADD CONSTRAINT church_announcements_category_check
        CHECK (category IN ('general', 'mass_schedule', 'event', 'emergency', 'reminder'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_church_announcements_category ON public.church_announcements(category);
CREATE INDEX IF NOT EXISTS idx_church_announcements_scheduled_at ON public.church_announcements(scheduled_at);

COMMENT ON COLUMN public.church_announcements.category IS 'Category tag for the announcement: general, mass_schedule, event, emergency, reminder';
COMMENT ON COLUMN public.church_announcements.scheduled_at IS 'Optional scheduled publication timestamp';
