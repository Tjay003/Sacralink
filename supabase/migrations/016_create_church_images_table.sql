-- Create church_images table for multi-image gallery
-- Migration: 016_create_church_images_table

-- Create the table
CREATE TABLE IF NOT EXISTS church_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INT DEFAULT 0,
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX idx_church_images_church_id ON church_images(church_id);
CREATE INDEX idx_church_images_display_order ON church_images(church_id, display_order);

-- Enable RLS
ALTER TABLE church_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public can view all gallery images
CREATE POLICY "Anyone can view church images"
ON church_images
FOR SELECT
TO public
USING (true);

-- Authenticated users can insert images for churches they manage
CREATE POLICY "Admins can upload church images"
ON church_images
FOR INSERT
TO authenticated
WITH CHECK (
    uploaded_by = auth.uid()
    AND (
        -- Super Admin can upload to any church
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
        OR
        -- Admin can upload to their church
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
            AND profiles.church_id = church_images.church_id
        )
        OR
        -- Church Admin can upload to their assigned church
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'church_admin'
            AND profiles.assigned_church_id = church_images.church_id
        )
        OR
        -- Volunteer can upload to their assigned church
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'volunteer'
            AND profiles.assigned_church_id = church_images.church_id
        )
    )
);

-- Admins can delete images from churches they manage
CREATE POLICY "Admins can delete church images"
ON church_images
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (
            profiles.role = 'super_admin'
            OR (profiles.role = 'admin' AND profiles.church_id = church_images.church_id)
            OR (profiles.role = 'church_admin' AND profiles.assigned_church_id = church_images.church_id)
            OR (profiles.role = 'volunteer' AND profiles.assigned_church_id = church_images.church_id)
        )
    )
);

-- Admins can update images (reorder) for churches they manage
CREATE POLICY "Admins can update church images"
ON church_images
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (
            profiles.role = 'super_admin'
            OR (profiles.role = 'admin' AND profiles.church_id = church_images.church_id)
            OR (profiles.role = 'church_admin' AND profiles.assigned_church_id = church_images.church_id)
            OR (profiles.role = 'volunteer' AND profiles.assigned_church_id = church_images.church_id)
        )
    )
);
