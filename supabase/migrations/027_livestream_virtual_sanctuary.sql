-- Migration: 027_livestream_virtual_sanctuary.sql
-- Livestream Virtual Sanctuary support: metadata, candle counter, and prayer intentions tracking

-- 1. Add livestream columns and candle_count to churches
ALTER TABLE public.churches
ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS livestream_title TEXT,
ADD COLUMN IF NOT EXISTS livestream_platform TEXT DEFAULT 'facebook',
ADD COLUMN IF NOT EXISTS candle_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS livestream_started_at TIMESTAMPTZ;

-- 2. Create church_candle_prayers table
CREATE TABLE IF NOT EXISTS public.church_candle_prayers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    intention_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_church_candle_prayers_church_id ON public.church_candle_prayers(church_id);
CREATE INDEX IF NOT EXISTS idx_church_candle_prayers_created_at ON public.church_candle_prayers(created_at);

-- Enable RLS
ALTER TABLE public.church_candle_prayers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'church_candle_prayers' AND policyname = 'Anyone can view candle prayers'
    ) THEN
        CREATE POLICY "Anyone can view candle prayers"
        ON public.church_candle_prayers FOR SELECT
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'church_candle_prayers' AND policyname = 'Anyone or authenticated can insert candle prayers'
    ) THEN
        CREATE POLICY "Anyone or authenticated can insert candle prayers"
        ON public.church_candle_prayers FOR INSERT
        WITH CHECK (true);
    END IF;
END $$;

-- 3. Atomic RPC function: light_church_candle
CREATE OR REPLACE FUNCTION public.light_church_candle(
    target_church_id UUID,
    user_intention TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_count INTEGER;
BEGIN
    -- Increment church candle count
    UPDATE public.churches
    SET candle_count = COALESCE(candle_count, 0) + 1
    WHERE id = target_church_id
    RETURNING candle_count INTO new_count;

    -- Record the prayer intention
    INSERT INTO public.church_candle_prayers (church_id, user_id, intention_text)
    VALUES (target_church_id, auth.uid(), user_intention);

    RETURN COALESCE(new_count, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.light_church_candle(UUID, TEXT) TO authenticated, anon;
