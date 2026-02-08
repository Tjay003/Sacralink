-- Migration: Add status column to churches table
-- This allows churches to be marked as active or inactive

-- Add status column with default 'active'
ALTER TABLE public.churches 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' 
CHECK (status IN ('active', 'inactive'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_churches_status ON public.churches(status);

-- Update existing churches to 'active' status
UPDATE public.churches SET status = 'active' WHERE status IS NULL;

-- Add comment
COMMENT ON COLUMN public.churches.status IS 'Church status: active or inactive. Inactive churches are hidden from regular users.';
