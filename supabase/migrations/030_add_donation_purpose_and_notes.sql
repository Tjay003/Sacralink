-- Add purpose and donor_notes columns to donations table
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS donor_notes text;
