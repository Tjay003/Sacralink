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

-- =========================================================
-- MIGRATION 034: Secure Donations Super Admin Blindspot
-- =========================================================
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own donations" ON public.donations;
DROP POLICY IF EXISTS "Users can create donations" ON public.donations;
DROP POLICY IF EXISTS "Users can create own donations" ON public.donations;
DROP POLICY IF EXISTS "Admins can view church donations" ON public.donations;
DROP POLICY IF EXISTS "Church admins can view church donations" ON public.donations;
DROP POLICY IF EXISTS "Parish staff can view church donations" ON public.donations;
DROP POLICY IF EXISTS "Donors can view own donations" ON public.donations;
DROP POLICY IF EXISTS "Donors can create donations" ON public.donations;
DROP POLICY IF EXISTS "Admins can update church donations" ON public.donations;
DROP POLICY IF EXISTS "Parish staff can update church donations" ON public.donations;
DROP POLICY IF EXISTS "Super admins can view all donations" ON public.donations;
DROP POLICY IF EXISTS "Super admins can update all donations" ON public.donations;

CREATE POLICY "Donors can view own donations"
ON public.donations FOR SELECT
USING (
  auth.uid() = user_id
  AND public.get_current_user_role() != 'super_admin'
);

CREATE POLICY "Parish staff can view church donations"
ON public.donations FOR SELECT
USING (
  public.get_current_user_role() IN ('church_admin', 'admin')
  AND public.get_current_user_church_id() IS NOT NULL
  AND church_id = public.get_current_user_church_id()
);

CREATE POLICY "Donors can create donations"
ON public.donations FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.get_current_user_role() != 'super_admin'
);

CREATE POLICY "Parish staff can update church donations"
ON public.donations FOR UPDATE
USING (
  public.get_current_user_role() IN ('church_admin', 'admin')
  AND public.get_current_user_church_id() IS NOT NULL
  AND church_id = public.get_current_user_church_id()
)
WITH CHECK (
  public.get_current_user_role() IN ('church_admin', 'admin')
  AND public.get_current_user_church_id() IS NOT NULL
  AND church_id = public.get_current_user_church_id()
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('donation-proofs', 'donation-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Donors can upload donation proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own donation proof" ON storage.objects;
DROP POLICY IF EXISTS "Donors can view own donation proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own donation proof" ON storage.objects;
DROP POLICY IF EXISTS "Parish staff can view church donation proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view donation proofs" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can view donation proofs" ON storage.objects;
DROP POLICY IF EXISTS "Donors can delete own donation proofs" ON storage.objects;

CREATE POLICY "Donors can upload donation proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'donation-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.get_current_user_role() != 'super_admin'
);

CREATE POLICY "Donors can view own donation proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'donation-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.get_current_user_role() != 'super_admin'
);

CREATE POLICY "Parish staff can view church donation proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'donation-proofs'
  AND public.get_current_user_role() IN ('church_admin', 'admin')
  AND public.get_current_user_church_id() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.donations d
    WHERE d.church_id = public.get_current_user_church_id()
      AND (
        d.user_id::text = (storage.foldername(name))[1]
        OR d.proof_url LIKE '%' || name || '%'
      )
  )
);

CREATE POLICY "Donors can delete own donation proofs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'donation-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.get_current_user_role() != 'super_admin'
);

-- =========================================================
-- MIGRATION 035: Add is_priest to profiles
-- =========================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_priest BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_profiles_is_priest ON public.profiles(is_priest);

-- =========================================================
-- MIGRATION 036: Restrict Parishioner Direct Messaging (Office Gateway Pattern)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_user_role(target_user_id UUID)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(role, 'user') FROM public.profiles WHERE id = target_user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_user_priest(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user_id
      AND (role = 'priest' OR COALESCE(is_priest, false) = true)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_user_priest(UUID) TO authenticated, anon;

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    (
      type = 'direct'
      AND (created_by IS NULL OR created_by = auth.uid())
    )
    OR (
      type = 'channel'
      AND (
        public.get_current_user_role() = 'super_admin'
        OR (
          public.get_current_user_role() IN ('admin', 'church_admin', 'priest', 'volunteer')
          AND church_id IS NOT NULL
          AND church_id = public.get_current_user_church_id()
        )
      )
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can join or add participants" ON public.conversation_participants;

CREATE POLICY "Authenticated users can join or add participants"
ON public.conversation_participants FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    (
      public.get_current_user_role() = 'super_admin'
      OR (
        public.get_current_user_role() IN ('admin', 'church_admin', 'priest', 'volunteer')
        AND EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = conversation_id
            AND c.type = 'channel'
            AND c.church_id = public.get_current_user_church_id()
        )
      )
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id AND c.type = 'direct'
      )
      AND (
        public.get_current_user_role() = 'super_admin'
        OR
        (
          user_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND c.created_by = auth.uid()
          )
        )
        OR
        (
          public.get_current_user_role() IN ('admin', 'church_admin')
          AND EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND c.created_by = auth.uid()
          )
        )
        OR
        (
          public.get_current_user_role() IN ('user', 'volunteer')
          AND EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND c.created_by = auth.uid()
          )
          AND public.get_user_role(user_id) IN ('super_admin', 'admin', 'church_admin')
          AND NOT public.is_user_priest(user_id)
        )
        OR
        (
          public.is_user_priest(auth.uid())
          AND EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND c.created_by = auth.uid()
          )
          AND (
            public.get_user_role(user_id) IN ('admin', 'church_admin', 'super_admin')
            OR public.is_user_priest(user_id)
            OR (
              public.get_user_role(user_id) = 'user'
              AND EXISTS (
                SELECT 1 FROM public.appointments a
                WHERE a.priest_id = auth.uid()
                  AND a.user_id = conversation_participants.user_id
              )
            )
          )
        )
      )
    )
  )
);

-- =========================================================
-- MIGRATION 037: Limit Concurrent Pending Appointments
-- =========================================================
CREATE OR REPLACE FUNCTION public.check_pending_appointments_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.appointments WHERE user_id = NEW.user_id AND status = 'pending') >= 3 THEN
    RAISE EXCEPTION 'You have reached the limit of 3 pending sacrament appointments. Please await confirmation before submitting additional requests.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_pending_appointments_limit ON public.appointments;

CREATE TRIGGER trg_check_pending_appointments_limit
BEFORE INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.check_pending_appointments_limit();

-- Ensure conversations SELECT policy is restricted to direct and parish staff channels
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
CREATE POLICY "Users can view conversations they participate in"
ON public.conversations FOR SELECT
USING (
  (
    type = 'direct'
    AND (
      public.is_conversation_participant(id, auth.uid())
      OR created_by = auth.uid()
      OR public.get_current_user_role() = 'super_admin'
    )
  )
  OR
  (
    type = 'channel'
    AND (
      public.get_current_user_role() = 'super_admin'
      OR (
        public.get_current_user_role() IN ('admin', 'church_admin', 'priest', 'volunteer')
        AND church_id IS NOT NULL
        AND church_id = public.get_current_user_church_id()
      )
    )
  )
);

-- =========================================================
-- MIGRATION 038: Fix Church Update RLS and Storage Policies for QR Codes
-- =========================================================

-- 1. Ensure QR columns exist on public.churches table
ALTER TABLE public.churches
ADD COLUMN IF NOT EXISTS gcash_qr_url text,
ADD COLUMN IF NOT EXISTS maya_qr_url text;

-- 2. Fix UPDATE policy on public.churches
DROP POLICY IF EXISTS "Admins and volunteers can update their church" ON public.churches;
DROP POLICY IF EXISTS "Admins, priests, and volunteers can update their church" ON public.churches;

CREATE POLICY "Admins, priests, and volunteers can update their church"
ON public.churches FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'super_admin'
      OR (
        profiles.role IN ('admin', 'church_admin', 'volunteer', 'priest')
        AND COALESCE(profiles.assigned_church_id, profiles.church_id) = churches.id
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.role = 'super_admin'
      OR (
        profiles.role IN ('admin', 'church_admin', 'volunteer', 'priest')
        AND COALESCE(profiles.assigned_church_id, profiles.church_id) = churches.id
      )
    )
  )
);

-- 3. Ensure Storage Buckets exist and are public
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('church-images', 'church-images', true),
  ('donation-qr', 'donation-qr', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Storage Policies on storage.objects for church-images & donation-qr
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parish staff can upload church images" ON storage.objects;
CREATE POLICY "Parish staff can upload church images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('church-images', 'donation-qr')
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'church_admin', 'volunteer', 'priest')
  )
);

DROP POLICY IF EXISTS "Parish staff can update church images" ON storage.objects;
CREATE POLICY "Parish staff can update church images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('church-images', 'donation-qr')
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'church_admin', 'volunteer', 'priest')
  )
);

DROP POLICY IF EXISTS "Parish staff can delete church images" ON storage.objects;
CREATE POLICY "Parish staff can delete church images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id IN ('church-images', 'donation-qr')
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin', 'church_admin', 'volunteer', 'priest')
  )
);

DROP POLICY IF EXISTS "Public can view church images" ON storage.objects;
CREATE POLICY "Public can view church images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('church-images', 'donation-qr'));




