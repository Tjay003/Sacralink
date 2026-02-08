-- Migration: Create system announcements table
-- Super admins and admins can create app-wide announcements (maintenance, updates, etc.)

-- Create system_announcements table
CREATE TABLE IF NOT EXISTS public.system_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'maintenance', 'success')),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT system_announcements_title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
    CONSTRAINT system_announcements_content_not_empty CHECK (LENGTH(TRIM(content)) > 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_system_announcements_created_by ON public.system_announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_system_announcements_created_at ON public.system_announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_announcements_expires_at ON public.system_announcements(expires_at);
CREATE INDEX IF NOT EXISTS idx_system_announcements_is_active ON public.system_announcements(is_active);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_system_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_announcements_timestamp 
BEFORE UPDATE ON public.system_announcements
FOR EACH ROW EXECUTE FUNCTION update_system_announcements_updated_at();

-- Enable RLS
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can manage system announcements
CREATE POLICY "Admins can manage system announcements"
ON public.system_announcements
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
);

-- RLS Policy: Everyone can read active, non-expired announcements
CREATE POLICY "Public can read active system announcements"
ON public.system_announcements
FOR SELECT
USING (
    is_active = true 
    AND (expires_at IS NULL OR expires_at > NOW())
);

-- Add comments
COMMENT ON TABLE public.system_announcements IS 'System-wide announcements for app maintenance, updates, etc.';
COMMENT ON COLUMN public.system_announcements.type IS 'Announcement type: info, warning, maintenance, or success';
COMMENT ON COLUMN public.system_announcements.expires_at IS 'Optional expiration date after which the announcement is hidden';
COMMENT ON COLUMN public.system_announcements.is_active IS 'Manually toggle announcement visibility';
