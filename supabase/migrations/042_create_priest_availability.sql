-- ============================================================================
-- Migration 042: Priest Availability & Blackout Schema
-- Canon 905 & Clergy Leave Management
-- ============================================================================

-- 1. Create table public.priest_availability if it doesn't already exist
CREATE TABLE IF NOT EXISTS public.priest_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    priest_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
    blackout_start DATE,
    blackout_end DATE,
    reason TEXT NOT NULL DEFAULT 'Clergy Retreat / Leave',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure all columns exist in case table was created previously with older schema
ALTER TABLE public.priest_availability 
    ADD COLUMN IF NOT EXISTS priest_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
    ADD COLUMN IF NOT EXISTS blackout_start DATE,
    ADD COLUMN IF NOT EXISTS blackout_end DATE,
    ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT 'Clergy Retreat / Leave',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Relax legacy NOT NULL constraints if existing table had them
DO $$
BEGIN
    ALTER TABLE public.priest_availability ALTER COLUMN church_id DROP NOT NULL;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'priest_availability' AND column_name = 'available_date'
    ) THEN
        ALTER TABLE public.priest_availability ALTER COLUMN available_date DROP NOT NULL;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'priest_availability' AND column_name = 'start_time'
    ) THEN
        ALTER TABLE public.priest_availability ALTER COLUMN start_time DROP NOT NULL;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'priest_availability' AND column_name = 'end_time'
    ) THEN
        ALTER TABLE public.priest_availability ALTER COLUMN end_time DROP NOT NULL;
    END IF;
END $$;

-- 4. Enable Row Level Security
ALTER TABLE public.priest_availability ENABLE ROW LEVEL SECURITY;

-- 5. Drop any legacy policies to prevent collisions
DROP POLICY IF EXISTS "Priests can view own availability" ON public.priest_availability;
DROP POLICY IF EXISTS "Priests can manage own availability" ON public.priest_availability;
DROP POLICY IF EXISTS "Admins can view church priest availability" ON public.priest_availability;
DROP POLICY IF EXISTS "Priests can manage their availability" ON public.priest_availability;
DROP POLICY IF EXISTS "Priests can manage their own availability" ON public.priest_availability;
DROP POLICY IF EXISTS "Admins and parishioners can view priest availability" ON public.priest_availability;
DROP POLICY IF EXISTS "Authenticated users can view priest availability" ON public.priest_availability;

-- 6. Define RLS Policies
-- Priests can manage (SELECT, INSERT, UPDATE, DELETE) their own availability records
-- Super Admins also have management capabilities
CREATE POLICY "Priests can manage their own availability"
ON public.priest_availability
FOR ALL
TO authenticated
USING (
    auth.uid() = priest_id
    OR public.get_current_user_role() = 'super_admin'
)
WITH CHECK (
    auth.uid() = priest_id
    OR public.get_current_user_role() = 'super_admin'
);

-- Church Admins, Super Admins, and authenticated users scheduling appointments can SELECT rows
CREATE POLICY "Authenticated users can view priest availability"
ON public.priest_availability
FOR SELECT
TO authenticated
USING (true);

-- 7. Performance & lookup indices
CREATE INDEX IF NOT EXISTS idx_priest_availability_priest_id 
    ON public.priest_availability(priest_id);

CREATE INDEX IF NOT EXISTS idx_priest_availability_blackout 
    ON public.priest_availability(priest_id, blackout_start, blackout_end);

CREATE INDEX IF NOT EXISTS idx_priest_availability_day_of_week 
    ON public.priest_availability(priest_id, day_of_week);

-- 8. Updated at trigger
CREATE OR REPLACE FUNCTION update_priest_availability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_priest_availability_updated_at ON public.priest_availability;
CREATE TRIGGER trg_priest_availability_updated_at
BEFORE UPDATE ON public.priest_availability
FOR EACH ROW EXECUTE FUNCTION update_priest_availability_updated_at();
