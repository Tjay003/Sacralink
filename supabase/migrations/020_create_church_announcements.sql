-- Migration: Create church announcements table
-- Church admins can create announcements specific to their church

-- Create church_announcements table
CREATE TABLE IF NOT EXISTS public.church_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_pinned BOOLEAN DEFAULT false,
    CONSTRAINT church_announcements_title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
    CONSTRAINT church_announcements_content_not_empty CHECK (LENGTH(TRIM(content)) > 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_church_announcements_church_id ON public.church_announcements(church_id);
CREATE INDEX IF NOT EXISTS idx_church_announcements_created_by ON public.church_announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_church_announcements_created_at ON public.church_announcements(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_church_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_church_announcements_timestamp 
BEFORE UPDATE ON public.church_announcements
FOR EACH ROW EXECUTE FUNCTION update_church_announcements_updated_at();

-- Enable RLS
ALTER TABLE public.church_announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Church admins and volunteers can manage their church's announcements
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
                (profiles.role = 'church_admin' OR profiles.role = 'volunteer')
                AND profiles.assigned_church_id = church_announcements.church_id
            )
        )
    )
);

-- RLS Policy: Public can read announcements from active churches
CREATE POLICY "Public can read church announcements"
ON public.church_announcements
FOR SELECT
USING (
    church_id IN (
        SELECT id FROM public.churches WHERE status = 'active'
    )
);

-- Add comments
COMMENT ON TABLE public.church_announcements IS 'Church-specific announcements created by church admins';
COMMENT ON COLUMN public.church_announcements.is_pinned IS 'Pinned announcements appear at the top';
