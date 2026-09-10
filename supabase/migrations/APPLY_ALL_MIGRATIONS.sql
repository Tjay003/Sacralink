-- =========================================================
-- SACRALINK: APPLY ALL MIGRATIONS BATCH SCRIPT
-- =========================================================

-- MIGRATION 026: Single Super Admin & Ownership Transfer RPC
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_super_admin 
ON public.profiles (role) 
WHERE role = 'super_admin';

CREATE OR REPLACE FUNCTION public.transfer_super_admin(target_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID;
    caller_role TEXT;
    target_exists BOOLEAN;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: No active session');
    END IF;

    -- Verify caller is super_admin
    SELECT role INTO caller_role FROM public.profiles WHERE id = caller_id;
    IF caller_role IS NULL OR caller_role != 'super_admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Only the current Super Admin can transfer ownership');
    END IF;

    IF caller_id = target_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target user is already the Super Admin');
    END IF;

    -- Check target user exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = target_user_id) INTO target_exists;
    IF NOT target_exists THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target user not found');
    END IF;

    -- Atomic transfer:
    -- 1. Demote current super admin to admin
    UPDATE public.profiles
    SET role = 'admin', updated_at = NOW()
    WHERE id = caller_id;

    -- 2. Promote target user to super_admin
    UPDATE public.profiles
    SET role = 'super_admin', assigned_church_id = NULL, church_id = NULL, updated_at = NOW()
    WHERE id = target_user_id;

    -- 3. Log to activity_logs
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
        caller_id,
        'transfer_super_admin',
        'profiles',
        target_user_id,
        jsonb_build_object('previous_owner_id', caller_id, 'new_owner_id', target_user_id)
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_super_admin(UUID) TO authenticated;

-- MIGRATION 027: Livestream Virtual Sanctuary (metadata, candle counter, and prayer intentions tracking)
ALTER TABLE public.churches
ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS livestream_title TEXT,
ADD COLUMN IF NOT EXISTS livestream_platform TEXT DEFAULT 'facebook',
ADD COLUMN IF NOT EXISTS candle_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS livestream_started_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.church_candle_prayers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    intention_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_church_candle_prayers_church_id ON public.church_candle_prayers(church_id);
CREATE INDEX IF NOT EXISTS idx_church_candle_prayers_created_at ON public.church_candle_prayers(created_at);

ALTER TABLE public.church_candle_prayers ENABLE ROW LEVEL SECURITY;

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
    UPDATE public.churches
    SET candle_count = COALESCE(candle_count, 0) + 1
    WHERE id = target_church_id
    RETURNING candle_count INTO new_count;

    INSERT INTO public.church_candle_prayers (church_id, user_id, intention_text)
    VALUES (target_church_id, auth.uid(), user_intention);

    RETURN COALESCE(new_count, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.light_church_candle(UUID, TEXT) TO authenticated, anon;

