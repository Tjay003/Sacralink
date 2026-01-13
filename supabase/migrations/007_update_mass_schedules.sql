-- Update mass_schedules table to match our application needs
-- Change day_of_week from int to text
-- Simplify time fields to single 'time' column

-- Drop existing table and recreate with correct structure
DROP TABLE IF EXISTS public.mass_schedules CASCADE;

CREATE TABLE public.mass_schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  church_id UUID REFERENCES public.churches ON DELETE CASCADE NOT NULL,
  day_of_week TEXT NOT NULL,  -- 'Sunday', 'Monday', etc.
  time TIME NOT NULL,          -- Single time field (e.g., '08:00')
  language TEXT,               -- Optional language
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX idx_mass_schedules_church ON mass_schedules(church_id);

-- Enable RLS
ALTER TABLE mass_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view mass schedules" 
  ON mass_schedules FOR SELECT 
  USING (true);

CREATE POLICY "Admins can manage church mass schedules" 
  ON mass_schedules FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND (church_id = mass_schedules.church_id OR role = 'super_admin')
    )
  );
