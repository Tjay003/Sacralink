-- Add missing columns to sacrament_requirements table

-- Add allowed_file_types column
ALTER TABLE sacrament_requirements 
ADD COLUMN IF NOT EXISTS allowed_file_types TEXT[] DEFAULT ARRAY['pdf', 'jpg', 'jpeg', 'png'];

-- Add display_order column
ALTER TABLE sacrament_requirements 
ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

-- Check appointment_documents schema and add missing columns if needed
ALTER TABLE appointment_documents 
ADD COLUMN IF NOT EXISTS file_type TEXT;

ALTER TABLE appointment_documents 
ADD COLUMN IF NOT EXISTS file_size INT;

ALTER TABLE appointment_documents 
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE appointment_documents 
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Remove old verification columns if they still exist
ALTER TABLE appointment_documents 
DROP COLUMN IF EXISTS is_verified;

ALTER TABLE appointment_documents 
DROP COLUMN IF EXISTS verified_by;

ALTER TABLE appointment_documents 
DROP COLUMN IF EXISTS verified_at;

-- Make file_name NOT NULL
ALTER TABLE appointment_documents 
ALTER COLUMN file_name SET NOT NULL;
