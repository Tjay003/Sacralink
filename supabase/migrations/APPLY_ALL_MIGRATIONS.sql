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






-- =========================================================
-- MIGRATION 040: Allow Parish Office Inquiry Conversations
-- =========================================================

-- 1. Update conversations SELECT policy to allow viewing group conversations you participate in or created
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
  OR
  (
    type = 'group'
    AND (
      public.is_conversation_participant(id, auth.uid())
      OR created_by = auth.uid()
      OR public.get_current_user_role() = 'super_admin'
      OR (
        public.get_current_user_role() IN ('admin', 'church_admin')
        AND church_id IS NOT NULL
        AND church_id = public.get_current_user_church_id()
      )
    )
  )
);

-- 2. Update conversations INSERT policy to permit group conversations for parish inquiries
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
    OR
    (
      type = 'group'
      AND church_id IS NOT NULL
      AND (created_by IS NULL OR created_by = auth.uid())
    )
  )
);

-- 3. Update conversation_participants INSERT policy to allow adding participants to inquiry group conversations
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
    OR
    (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id AND c.type = 'group' AND c.church_id IS NOT NULL
      )
      AND (
        user_id = auth.uid()
        OR
        (
          EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND c.created_by = auth.uid()
          )
          AND (
            public.get_user_role(user_id) IN ('super_admin', 'admin', 'church_admin')
          )
        )
        OR
        (
          public.get_current_user_role() IN ('super_admin', 'admin', 'church_admin')
        )
      )
    )
  )
);

-- ==============================================================================
-- MIGRATION 054: Celebrant eligibility foundation
-- One server-side answer to "who presides where, and is this priest free?".
-- The approval and celebrant-change flows, the public clergy roster and the booking
-- pool check all read these functions instead of computing it in the browser.
--
-- 1. mass_schedules.presiding_priest_id: the priest who normally presides at a
--    recurring Mass. It is a weekly default, not a per-occurrence assignment.
-- 2. get_parish_clergy(p_church_id): the parish roster with a computed status
--    (available | in_mass | on_leave). Callable by anon and authenticated.
-- 3. evaluate_parish_celebrants(p_church_id, p_date, p_time, p_exclude_appointment_id):
--    per-priest eligibility, badge, daily count and warnings for one slot.
--    Callable by authenticated only.
-- 4. check_parish_slot(p_church_id, p_date, p_time): whether the slot is taken and
--    whether at least one priest is eligible. Callable by authenticated only.
--
-- Rules (settled in the client-enhancements grilling):
--   * A priest belongs to a parish when profiles.assigned_church_id OR church_id matches
--     and (is_priest = true OR role = 'priest').
--   * A parish with no priests has no priest constraint (everything is eligible).
--   * A priest's day commitments are his appointments (not cancelled or rejected) plus the
--     recurring Masses he presides at on that weekday. They drive the time collision check
--     (same HH:MM) and the Canon 905 limit (weekday 2, Sunday 3).
--   * Day off and leave come from priest_availability.day_of_week / blackout_start /
--     blackout_end keyed by priest_id (the columns the priest dashboard writes).
--
-- Every function is SECURITY DEFINER and returns computed status only. The leave reason
-- (priest_availability.reason), email and phone number are never returned.
-- ASCII only: the section sign of the Canon 905 warnings is built with chr(167) so the file
-- survives any shell encoding when it is piped into psql.
-- ==============================================================================

-- 1. Presiding priest on a recurring Mass
ALTER TABLE public.mass_schedules
  ADD COLUMN IF NOT EXISTS presiding_priest_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mass_schedules_presiding_priest
  ON public.mass_schedules(presiding_priest_id)
  WHERE presiding_priest_id IS NOT NULL;

-- 2. Internal helper: does a mass_schedules.day_of_week label fall on this weekday index?
--    The column is text ('Sunday', 'Mon', or a legacy '0'-'6'); 0 = Sunday ... 6 = Saturday.
CREATE OR REPLACE FUNCTION public.mass_runs_on_weekday(p_label TEXT, p_dow INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(p_label) = p_dow::text
      OR lower(left(btrim(p_label), 3)) = lower(left((ARRAY['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'])[p_dow + 1], 3));
$$;

REVOKE ALL ON FUNCTION public.mass_runs_on_weekday(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

-- 3. get_parish_clergy
--    "Today" and "now" are read in Philippine time, the timezone of every parish served.
--    A priest is in_mass for the hour after a Mass he presides at starts.
CREATE OR REPLACE FUNCTION public.get_parish_clergy(p_church_id UUID)
RETURNS TABLE (
  priest_id UUID,
  name TEXT,
  title TEXT,
  designation TEXT,
  status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH local_now AS (
    SELECT (now() AT TIME ZONE 'Asia/Manila') AS ts
  ),
  today AS (
    SELECT ts::date AS d, ts::time AS t, extract(dow FROM ts)::integer AS dow
    FROM local_now
  )
  SELECT
    pr.id,
    COALESCE(
      NULLIF(btrim(regexp_replace(btrim(COALESCE(pr.full_name, '')), '^(rev(erend|\.)?\s+)?(fr\.?|father)\s+', '', 'i')), ''),
      'Clergy Member'
    ),
    'Rev. Fr.'::text,
    CASE WHEN pr.role::text = 'priest' THEN 'Priest' ELSE 'Parish Administrator' END,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.priest_availability pa
        WHERE pa.priest_id = pr.id
          AND (pa.day_of_week = today.dow
               OR (pa.blackout_start IS NOT NULL AND pa.blackout_end IS NOT NULL
                   AND today.d BETWEEN pa.blackout_start AND pa.blackout_end))
      ) THEN 'on_leave'
      WHEN EXISTS (
        SELECT 1 FROM public.mass_schedules m
        WHERE m.presiding_priest_id = pr.id
          AND public.mass_runs_on_weekday(m.day_of_week, today.dow)
          AND today.t - m.time >= interval '0'
          AND today.t - m.time < interval '1 hour'
      ) THEN 'in_mass'
      ELSE 'available'
    END
  FROM public.profiles pr
  CROSS JOIN today
  WHERE (pr.assigned_church_id = p_church_id OR pr.church_id = p_church_id)
    AND (COALESCE(pr.is_priest, false) OR pr.role::text = 'priest')
  ORDER BY 2, 1;
$$;

REVOKE ALL ON FUNCTION public.get_parish_clergy(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_parish_clergy(UUID) TO anon, authenticated;

-- 4. evaluate_parish_celebrants
--    Mirrors the browser-side evaluateCelebrantAssignment: day off / leave, exact time collision,
--    Canon 905 daily limit, with the same badges and warnings, now counting recurring Masses too.
--    p_exclude_appointment_id leaves the appointment being edited out of the priest's own load.
--    A null p_time skips the time collision check.
CREATE OR REPLACE FUNCTION public.evaluate_parish_celebrants(
  p_church_id UUID,
  p_date DATE,
  p_time TIME,
  p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS TABLE (
  priest_id UUID,
  eligible BOOLEAN,
  status TEXT,
  badge_text TEXT,
  badge_variant TEXT,
  warnings TEXT[],
  daily_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_dow INTEGER;
  v_is_sunday BOOLEAN;
  v_max INTEGER;
  v_day_name TEXT;
  v_target TEXT := to_char(p_time, 'HH24:MI');
  v_pretty_time TEXT := to_char(p_time, 'FMHH12:MI AM');
  v_section TEXT := chr(167);
BEGIN
  IF p_church_id IS NULL OR p_date IS NULL THEN
    RETURN;
  END IF;

  v_dow := extract(dow FROM p_date)::integer;
  v_is_sunday := v_dow = 0;
  v_max := CASE WHEN v_is_sunday THEN 3 ELSE 2 END;
  v_day_name := (ARRAY['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'])[v_dow + 1];

  RETURN QUERY
  WITH pool AS (
    SELECT pr.id AS pid, COALESCE(pr.full_name, '') AS pname
    FROM public.profiles pr
    WHERE (pr.assigned_church_id = p_church_id OR pr.church_id = p_church_id)
      AND (COALESCE(pr.is_priest, false) OR pr.role::text = 'priest')
  ),
  commitments AS (
    SELECT a.priest_id AS pid, a.appointment_time AS t, COALESCE(a.service_type, 'Sacrament') AS label
    FROM public.appointments a
    WHERE a.appointment_date = p_date
      AND COALESCE(a.status, '') NOT IN ('cancelled', 'rejected')
      AND a.priest_id IN (SELECT pid FROM pool)
      AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
    UNION ALL
    SELECT m.presiding_priest_id, m.time, 'Mass'
    FROM public.mass_schedules m
    WHERE m.presiding_priest_id IN (SELECT pid FROM pool)
      AND public.mass_runs_on_weekday(m.day_of_week, v_dow)
  ),
  tally AS (
    SELECT
      pool.pid,
      pool.pname,
      (SELECT count(*) FROM commitments c WHERE c.pid = pool.pid)::integer AS n,
      (SELECT c.label FROM commitments c
        WHERE c.pid = pool.pid AND v_target IS NOT NULL AND to_char(c.t, 'HH24:MI') = v_target
        ORDER BY c.t LIMIT 1) AS clash_label,
      EXISTS (
        SELECT 1 FROM public.priest_availability pa
        WHERE pa.priest_id = pool.pid AND pa.day_of_week = v_dow
      ) AS day_off,
      EXISTS (
        SELECT 1 FROM public.priest_availability pa
        WHERE pa.priest_id = pool.pid
          AND pa.blackout_start IS NOT NULL AND pa.blackout_end IS NOT NULL
          AND p_date BETWEEN pa.blackout_start AND pa.blackout_end
      ) AS on_leave
    FROM pool
  ),
  scored AS (
    SELECT t.*, (t.n >= v_max) AS canon, (t.clash_label IS NOT NULL) AS clash
    FROM tally t
  )
  SELECT
    s.pid,
    NOT (s.day_off OR s.on_leave OR s.clash OR s.canon),
    CASE
      WHEN s.day_off OR s.on_leave THEN 'blackout'
      WHEN s.clash THEN 'busy'
      WHEN s.canon THEN 'canon_limit'
      ELSE 'available'
    END,
    CASE
      WHEN s.day_off THEN 'Day Off'
      WHEN s.on_leave THEN 'Unavailable / Leave'
      WHEN s.clash THEN 'Time Collision'
      WHEN s.canon THEN 'Canon 905 Limit (' || s.n || '/' || v_max || ')'
      WHEN s.n > 0 THEN s.n || ' scheduled'
      ELSE 'Available (0 commitments)'
    END,
    CASE
      WHEN s.day_off OR s.on_leave OR s.clash OR s.canon THEN 'destructive'
      WHEN s.n > 0 THEN 'warning'
      ELSE 'success'
    END,
    array_remove(ARRAY[
      CASE
        WHEN s.day_off THEN 'Father is on his weekly day off (' || v_day_name || ').'
        WHEN s.on_leave THEN 'Father is away on clergy leave or retreat.'
      END,
      CASE
        WHEN s.clash THEN 'Temporal Conflict: Father is already presiding another liturgy ('
          || s.clash_label || ') at ' || v_pretty_time || '.'
      END,
      CASE
        WHEN s.canon THEN 'Canon 905 Admonition: Father already has ' || s.n || ' liturgical celebration'
          || CASE WHEN s.n > 1 THEN 's' ELSE '' END || ' scheduled on this '
          || CASE WHEN v_is_sunday
               THEN 'Sunday (maximum 3 allowed by Canon 905 ' || v_section || '2)'
               ELSE 'weekday (maximum 2 allowed by Canon 905 ' || v_section || '1)' END || '.'
        WHEN s.n > 0 THEN 'Father already has ' || s.n || ' liturgical celebration'
          || CASE WHEN s.n > 1 THEN 's' ELSE '' END || ' scheduled on this day ('
          || s.n || '/' || v_max || ' Canon 905 threshold).'
      END
    ], NULL),
    s.n
  FROM scored s
  ORDER BY s.n, s.pname, s.pid;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_parish_celebrants(UUID, DATE, TIME, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_parish_celebrants(UUID, DATE, TIME, UUID) TO authenticated;

-- 5. check_parish_slot
--    slot_taken mirrors the booking page rule: any pending or approved request at the parish
--    for that date and time (cancelled and rejected requests free the slot). Row level security
--    hides other parishioners' bookings from the browser, which is why this runs here.
--    has_eligible_priest is true when at least one priest of the parish is eligible, and also
--    when the parish has no priests (priest_count = 0), so callers fall back to slot logic.
CREATE OR REPLACE FUNCTION public.check_parish_slot(
  p_church_id UUID,
  p_date DATE,
  p_time TIME
)
RETURNS TABLE (
  slot_taken BOOLEAN,
  has_eligible_priest BOOLEAN,
  priest_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_taken BOOLEAN;
  v_total INTEGER;
  v_eligible INTEGER;
BEGIN
  v_taken := p_church_id IS NOT NULL AND p_date IS NOT NULL AND p_time IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.church_id = p_church_id
      AND a.appointment_date = p_date
      AND to_char(a.appointment_time, 'HH24:MI') = to_char(p_time, 'HH24:MI')
      AND COALESCE(a.status, '') NOT IN ('cancelled', 'rejected')
  );

  SELECT count(*)::integer, (count(*) FILTER (WHERE e.eligible))::integer
    INTO v_total, v_eligible
  FROM public.evaluate_parish_celebrants(p_church_id, p_date, p_time) e;

  RETURN QUERY SELECT v_taken, (v_total = 0 OR v_eligible > 0), v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.check_parish_slot(UUID, DATE, TIME) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_parish_slot(UUID, DATE, TIME) TO authenticated;

-- ==============================================================================
-- MIGRATION 055: Optional priest request at booking
-- A parishioner may ask for a specific priest of the parish when booking. The request is
-- a preference, never the assignment: appointments.priest_id (the celebrant) is still set
-- only when the parish office approves or changes the celebrant.
--
-- 1. appointments.requested_priest_id: nullable, cleared (not cascaded) when the priest's
--    profile is deleted. Existing rows and clients that never send it (the mobile app) are
--    unaffected.
-- 2. A trigger keeps the request honest: it must name a priest of the appointment's parish
--    (the same membership rule as get_parish_clergy). The parishioner INSERT and pending
--    UPDATE policies already let a user write their own request, so no policy changes.
-- 3. approve_appointment (signature and behavior unchanged) adds one sentence to the
--    parishioner's approval notification when the request exists and the approved celebrant
--    is someone else (or nobody), so the parishioner knows the request was not honored.
--    The leave reason of any priest is never read or written here.
-- ==============================================================================

-- 1. The request
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS requested_priest_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_requested_priest
  ON public.appointments(requested_priest_id)
  WHERE requested_priest_id IS NOT NULL;

-- 2. The requested priest must belong to the appointment's parish
CREATE OR REPLACE FUNCTION public.validate_requested_priest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.requested_priest_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = NEW.requested_priest_id
      AND (pr.assigned_church_id = NEW.church_id OR pr.church_id = NEW.church_id)
      AND (COALESCE(pr.is_priest, false) OR pr.role::text = 'priest')
  ) THEN
    RAISE EXCEPTION 'The requested priest is not a priest of this parish' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_requested_priest() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_requested_priest ON public.appointments;
CREATE TRIGGER validate_requested_priest
  BEFORE INSERT OR UPDATE OF requested_priest_id, church_id ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_requested_priest();

-- 3. approve_appointment: same signature and behavior as migration 052, plus the substitution sentence
CREATE OR REPLACE FUNCTION public.approve_appointment(
  p_appointment_id UUID,
  p_priest_id UUID DEFAULT NULL,
  p_admin_feedback TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_actor_church UUID;
  v_apt public.appointments%ROWTYPE;
  v_feedback TEXT := NULLIF(btrim(COALESCE(p_admin_feedback, '')), '');
  v_priest_ok BOOLEAN;
  v_requested_name TEXT;
  v_assigned_name TEXT;
  v_message TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT role::text, COALESCE(assigned_church_id, church_id)
    INTO v_actor_role, v_actor_church
  FROM public.profiles
  WHERE id = v_actor_id;

  SELECT * INTO v_apt
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_actor_role IS NULL
     OR v_actor_role NOT IN ('super_admin', 'admin', 'church_admin')
     OR (v_actor_role <> 'super_admin' AND v_actor_church IS DISTINCT FROM v_apt.church_id) THEN
    RAISE EXCEPTION 'Only the parish office can approve this appointment' USING ERRCODE = '42501';
  END IF;

  IF v_apt.status::text <> 'pending' THEN
    RAISE EXCEPTION 'Only pending appointments can be approved' USING ERRCODE = '22023';
  END IF;

  IF p_priest_id IS NOT NULL THEN
    -- Same pool the approve modal offers (getChurchPriests)
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = p_priest_id
        AND (p.role::text IN ('priest', 'church_admin', 'admin') OR COALESCE(p.is_priest, false))
        AND (p.assigned_church_id = v_apt.church_id OR p.church_id = v_apt.church_id)
    ) INTO v_priest_ok;

    IF NOT v_priest_ok THEN
      RAISE EXCEPTION 'The selected celebrant is not a priest of this parish' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.appointments
  SET status = 'approved',
      priest_id = p_priest_id,
      admin_feedback = v_feedback,
      updated_at = NOW()
  WHERE id = v_apt.id;

  INSERT INTO public.appointment_changes (
    appointment_id, church_id, action, reason, before_values, after_values, changed_by
  ) VALUES (
    v_apt.id,
    v_apt.church_id,
    'approve',
    v_feedback,
    jsonb_build_object('status', 'pending'),
    CASE WHEN p_priest_id IS NULL
         THEN jsonb_build_object('status', 'approved')
         ELSE jsonb_build_object('status', 'approved', 'priest_id', p_priest_id) END,
    v_actor_id
  );

  v_message := 'Your ' || v_apt.service_type || ' appointment has been approved!';

  -- The parishioner asked for a specific priest and someone else (or nobody yet) was approved
  IF v_apt.requested_priest_id IS NOT NULL AND p_priest_id IS DISTINCT FROM v_apt.requested_priest_id THEN
    SELECT 'Fr. ' || COALESCE(
             NULLIF(btrim(regexp_replace(btrim(COALESCE(full_name, '')), '^(rev(erend|\.)?\s+)?(fr\.?|father)\s+', '', 'i')), ''),
             'Clergy Member')
      INTO v_requested_name
    FROM public.profiles
    WHERE id = v_apt.requested_priest_id;

    SELECT 'Fr. ' || COALESCE(
             NULLIF(btrim(regexp_replace(btrim(COALESCE(full_name, '')), '^(rev(erend|\.)?\s+)?(fr\.?|father)\s+', '', 'i')), ''),
             'Clergy Member')
      INTO v_assigned_name
    FROM public.profiles
    WHERE id = p_priest_id;

    v_message := v_message
      || ' The priest you requested'
      || COALESCE(' (' || v_requested_name || ')', '')
      || ' could not be assigned'
      || CASE WHEN v_assigned_name IS NOT NULL
              THEN '; ' || v_assigned_name || ' will preside instead.'
              ELSE ', and the parish office will confirm the celebrant.' END;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    v_apt.user_id,
    'appointment_approved',
    'Appointment Approved',
    v_message,
    '/appointments'
  );

  IF p_priest_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      p_priest_id,
      'appointment',
      'New Sacramental Assignment',
      'You have been assigned as celebrant for a ' || v_apt.service_type
        || ' on ' || v_apt.appointment_date::text
        || ' at ' || to_char(v_apt.appointment_time::time, 'FMHH12:MI AM') || '.',
      '/appointments'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_appointment(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_appointment(UUID, UUID, TEXT) TO authenticated;

-- ==============================================================================
-- MIGRATION 056: Church-owned service types
-- Each parish owns the list of services it offers. The six built-ins (Baptism, Wedding,
-- Funeral, Confirmation, Blessing, Other) are only the starter template: every existing
-- parish is backfilled with them and every new parish is seeded with them, after which a
-- parish can rename, hide, delete or add services freely.
--
-- 1. church_service_types: name, optional description, display order, hidden flag,
--    soft-delete stamp and a stable "kind" (the starter key that survives a rename, used
--    for behaviour such as the Funeral burial fields). Names are unique per parish,
--    case-insensitive, among non-deleted rows.
-- 2. appointments.service_type_id and sacrament_requirements.service_type_id link rows to
--    a service by id. The legacy text columns STAY and are kept in step with the service
--    name (appointments: the name; requirements: the lowercased name, the established
--    convention), so mobile, notification SQL and dashboards that read text keep working.
--    The 6-value CHECK on appointments.service_type is dropped.
-- 3. A BEFORE INSERT trigger on both tables fills service_type_id from
--    (church_id, lower(service_type)) when it is null, so old clients (the live web build,
--    the mobile app) that insert by text only still produce linked rows. Text that matches no
--    service of the parish creates one (hidden, so a parish that renamed or dropped a service
--    is not forced to offer it again) instead of failing the booking.
-- 4. Renaming a service updates the mirrored text columns in the same transaction.
-- 5. RLS: reads are public (booking needs them); only that parish's church_admin, plus admin
--    and super_admin, can insert or update. There is no DELETE policy: removal goes through
--    delete_church_service_type(), which soft-deletes when the service has appointments and
--    physically removes it (with its checklist) when it has none. The same staff may also
--    write the parish checklist (sacrament_requirements), which ticket 06 builds a UI on.
-- 6. Backfill (idempotent, additive, atomic): backfill_church_service_types() seeds the six
--    for parishes that have no services yet, then links every unlinked appointment and
--    requirement by lowercased text, creating a hidden service for text that matches nothing.
--    No existing text value is ever rewritten and no row is deleted. The migration fails as a
--    whole when a row is lost or left unlinked.
--
-- sacrament_requirements.service_type was the sacrament_type enum on databases built from
-- the first schema (it cannot hold custom names); it is converted to text, a no-op where it is
-- already text. ASCII only so the file survives any shell encoding when piped into psql.
-- ==============================================================================

BEGIN;

-- 0. Legacy service_type columns must be able to hold any service name
DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['appointments', 'sacrament_requirements'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_table
        AND column_name = 'service_type' AND data_type <> 'text'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN service_type TYPE TEXT USING service_type::text', v_table);
    END IF;
  END LOOP;
END $$;

-- 1. Drop the 6-value CHECK on appointments.service_type (whatever it is named)
DO $$
DECLARE
  v_constraint RECORD;
BEGIN
  FOR v_constraint IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%service_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.appointments DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;
END $$;

-- 2. The services a parish offers
CREATE TABLE IF NOT EXISTS public.church_service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  description TEXT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ NULL,
  kind TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_church_service_types_name
  ON public.church_service_types (church_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_church_service_types_church_order
  ON public.church_service_types (church_id, display_order);

-- Trim names, turn a blank description into NULL, and never let a service change parish
CREATE OR REPLACE FUNCTION public.normalize_church_service_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.name := btrim(COALESCE(NEW.name, ''));
  NEW.description := NULLIF(btrim(COALESCE(NEW.description, '')), '');
  IF TG_OP = 'UPDATE' AND NEW.church_id IS DISTINCT FROM OLD.church_id THEN
    RAISE EXCEPTION 'A service cannot move to another parish' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_church_service_type ON public.church_service_types;
CREATE TRIGGER trg_normalize_church_service_type
  BEFORE INSERT OR UPDATE ON public.church_service_types
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_church_service_type();

-- 3. The links
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_type_id UUID NULL REFERENCES public.church_service_types(id) ON DELETE SET NULL;

ALTER TABLE public.sacrament_requirements
  ADD COLUMN IF NOT EXISTS service_type_id UUID NULL REFERENCES public.church_service_types(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_appointments_service_type_id
  ON public.appointments (service_type_id)
  WHERE service_type_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sacrament_requirements_service_type_id
  ON public.sacrament_requirements (service_type_id)
  WHERE service_type_id IS NOT NULL;

-- 4. Who may manage a parish's services (and checklist): that parish's church_admin, plus admin and
--    super_admin (system-wide roles; the web "Add church" page is theirs too)
CREATE OR REPLACE FUNCTION public.can_manage_church_services(p_church_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_church_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND (
        pr.role::text IN ('super_admin', 'admin')
        OR (pr.role::text = 'church_admin'
            AND COALESCE(pr.assigned_church_id, pr.church_id) = p_church_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_church_services(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_church_services(UUID) TO authenticated, service_role;

-- 5. RLS
ALTER TABLE public.church_service_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service types are viewable by everyone" ON public.church_service_types;
CREATE POLICY "Service types are viewable by everyone"
  ON public.church_service_types FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Parish staff can add service types" ON public.church_service_types;
CREATE POLICY "Parish staff can add service types"
  ON public.church_service_types FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_church_services(church_id));

DROP POLICY IF EXISTS "Parish staff can edit service types" ON public.church_service_types;
CREATE POLICY "Parish staff can edit service types"
  ON public.church_service_types FOR UPDATE
  TO authenticated
  USING (public.can_manage_church_services(church_id))
  WITH CHECK (public.can_manage_church_services(church_id));

REVOKE ALL ON TABLE public.church_service_types FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.church_service_types TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.church_service_types TO authenticated;
GRANT ALL ON TABLE public.church_service_types TO service_role;

-- The parish's own staff may write its checklist (the Services and Documents manager).
-- Older policies on sacrament_requirements stay; permissive policies add up.
DROP POLICY IF EXISTS "Parish staff can manage their checklist" ON public.sacrament_requirements;
CREATE POLICY "Parish staff can manage their checklist"
  ON public.sacrament_requirements FOR ALL
  TO authenticated
  USING (public.can_manage_church_services(church_id))
  WITH CHECK (public.can_manage_church_services(church_id));

-- 6. Find the service of a parish for a piece of text, creating a hidden one when none exists.
--    A live service wins over a deleted one; text that only matches a deleted service links to it
--    so a deleted service is never brought back by an old client.
CREATE OR REPLACE FUNCTION public.resolve_service_type_id(p_church_id UUID, p_text TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text TEXT := btrim(COALESCE(p_text, ''));
  v_id UUID;
BEGIN
  IF p_church_id IS NULL OR v_text = '' THEN
    RETURN NULL;
  END IF;

  SELECT t.id INTO v_id
  FROM public.church_service_types t
  WHERE t.church_id = p_church_id AND lower(t.name) = lower(v_text)
  ORDER BY (t.deleted_at IS NULL) DESC, t.created_at DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.church_service_types (church_id, name, display_order, is_hidden)
  VALUES (
    p_church_id,
    v_text,
    COALESCE((SELECT max(t.display_order) FROM public.church_service_types t WHERE t.church_id = p_church_id), 0) + 1,
    true
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT t.id INTO v_id
    FROM public.church_service_types t
    WHERE t.church_id = p_church_id AND lower(t.name) = lower(v_text) AND t.deleted_at IS NULL
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_service_type_id(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- 7. Link trigger. On INSERT it fills service_type_id from the text when absent and then keeps the
--    text equal to the service name. On UPDATE of the link it only checks that the service belongs
--    to the row's parish (the backfill relies on that: it never rewrites existing text).
CREATE OR REPLACE FUNCTION public.link_service_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type public.church_service_types%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.service_type_id IS NULL THEN
    NEW.service_type_id := public.resolve_service_type_id(NEW.church_id, NEW.service_type);
  END IF;

  IF NEW.service_type_id IS NOT NULL THEN
    SELECT * INTO v_type FROM public.church_service_types WHERE id = NEW.service_type_id;
    IF NOT FOUND OR v_type.church_id IS DISTINCT FROM NEW.church_id THEN
      RAISE EXCEPTION 'The service does not belong to this parish' USING ERRCODE = '22023';
    END IF;

    IF TG_OP = 'INSERT' THEN
      IF TG_TABLE_NAME = 'sacrament_requirements' THEN
        NEW.service_type := lower(v_type.name);
      ELSE
        NEW.service_type := v_type.name;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.link_service_type() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_link_service_type ON public.appointments;
CREATE TRIGGER trg_link_service_type
  BEFORE INSERT OR UPDATE OF service_type_id, church_id ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.link_service_type();

DROP TRIGGER IF EXISTS trg_link_service_type ON public.sacrament_requirements;
CREATE TRIGGER trg_link_service_type
  BEFORE INSERT OR UPDATE OF service_type_id, church_id ON public.sacrament_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.link_service_type();

-- 8. A rename follows everywhere, including past appointments, in the same transaction.
--    Notifications already sent keep their old wording.
CREATE OR REPLACE FUNCTION public.sync_service_type_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.appointments
  SET service_type = NEW.name
  WHERE service_type_id = NEW.id AND service_type IS DISTINCT FROM NEW.name;

  UPDATE public.sacrament_requirements
  SET service_type = lower(NEW.name)
  WHERE service_type_id = NEW.id AND service_type IS DISTINCT FROM lower(NEW.name);

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_service_type_name() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_service_type_name ON public.church_service_types;
CREATE TRIGGER trg_sync_service_type_name
  AFTER UPDATE OF name ON public.church_service_types
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION public.sync_service_type_name();

-- 9. The starter template. A starter that the parish already has (by kind or by name, deleted or
--    not) is never added again, so re-seeding never undoes a rename or a deletion.
CREATE OR REPLACE FUNCTION public.insert_starter_service_types(p_church_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.church_service_types (church_id, name, kind, display_order)
  SELECT p_church_id, s.name, s.kind, s.ord
  FROM (VALUES
    ('Baptism', 'baptism', 1),
    ('Wedding', 'wedding', 2),
    ('Funeral', 'funeral', 3),
    ('Confirmation', 'confirmation', 4),
    ('Blessing', 'blessing', 5),
    ('Other', 'other', 6)
  ) AS s(name, kind, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.church_service_types t
    WHERE t.church_id = p_church_id
      AND (t.kind = s.kind OR lower(t.name) = lower(s.name))
  )
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_starter_service_types(UUID) FROM PUBLIC, anon, authenticated;

-- Called by the web seeders for a new parish (and by the e2e setup with the service role)
CREATE OR REPLACE FUNCTION public.seed_church_service_types(p_church_id UUID)
RETURNS SETOF public.church_service_types
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.can_manage_church_services(p_church_id)) THEN
    RAISE EXCEPTION 'Only the parish office can set up its services' USING ERRCODE = '42501';
  END IF;

  PERFORM public.insert_starter_service_types(p_church_id);

  RETURN QUERY
  SELECT t.* FROM public.church_service_types t
  WHERE t.church_id = p_church_id AND t.deleted_at IS NULL
  ORDER BY t.display_order, t.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_church_service_types(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_church_service_types(UUID) TO authenticated, service_role;

-- 10. Delete: soft-delete when appointments use the service, physical delete (checklist cascades) when not
CREATE OR REPLACE FUNCTION public.delete_church_service_type(p_service_type_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type public.church_service_types%ROWTYPE;
BEGIN
  SELECT * INTO v_type
  FROM public.church_service_types
  WHERE id = p_service_type_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (auth.role() = 'service_role' OR public.can_manage_church_services(v_type.church_id)) THEN
    RAISE EXCEPTION 'Only the parish office can delete its services' USING ERRCODE = '42501';
  END IF;

  IF v_type.deleted_at IS NOT NULL THEN
    RETURN 'archived';
  END IF;

  IF EXISTS (SELECT 1 FROM public.appointments a WHERE a.service_type_id = v_type.id) THEN
    UPDATE public.church_service_types SET deleted_at = NOW() WHERE id = v_type.id;
    RETURN 'archived';
  END IF;

  DELETE FROM public.church_service_types WHERE id = v_type.id;
  RETURN 'deleted';
END;
$$;

REVOKE ALL ON FUNCTION public.delete_church_service_type(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_church_service_type(UUID) TO authenticated, service_role;

-- 11. Backfill. Safe to run any number of times; it only adds services and links.
CREATE OR REPLACE FUNCTION public.backfill_church_service_types()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church UUID;
  v_seeded INTEGER := 0;
  v_types_before BIGINT;
  v_types_after BIGINT;
  v_appointments INTEGER;
  v_requirements INTEGER;
BEGIN
  FOR v_church IN
    SELECT c.id FROM public.churches c
    WHERE NOT EXISTS (SELECT 1 FROM public.church_service_types t WHERE t.church_id = c.id)
  LOOP
    PERFORM public.insert_starter_service_types(v_church);
    v_seeded := v_seeded + 1;
  END LOOP;

  SELECT count(*) INTO v_types_before FROM public.church_service_types;

  UPDATE public.appointments a
  SET service_type_id = public.resolve_service_type_id(a.church_id, a.service_type)
  WHERE a.service_type_id IS NULL AND btrim(COALESCE(a.service_type, '')) <> '';
  GET DIAGNOSTICS v_appointments = ROW_COUNT;

  UPDATE public.sacrament_requirements r
  SET service_type_id = public.resolve_service_type_id(r.church_id, r.service_type)
  WHERE r.service_type_id IS NULL AND btrim(COALESCE(r.service_type, '')) <> '';
  GET DIAGNOSTICS v_requirements = ROW_COUNT;

  SELECT count(*) INTO v_types_after FROM public.church_service_types;

  RETURN jsonb_build_object(
    'churches_seeded', v_seeded,
    'types_created_from_text', v_types_after - v_types_before,
    'appointments_linked', v_appointments,
    'requirements_linked', v_requirements
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_church_service_types() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_church_service_types() TO service_role;

-- 12. Run the backfill now and fail the whole migration if a row was lost or left unlinked
DO $$
DECLARE
  v_appointments_before BIGINT;
  v_requirements_before BIGINT;
  v_result JSONB;
  v_unlinked BIGINT;
BEGIN
  SELECT count(*) INTO v_appointments_before FROM public.appointments;
  SELECT count(*) INTO v_requirements_before FROM public.sacrament_requirements;

  v_result := public.backfill_church_service_types();

  IF (SELECT count(*) FROM public.appointments) <> v_appointments_before
     OR (SELECT count(*) FROM public.sacrament_requirements) <> v_requirements_before THEN
    RAISE EXCEPTION 'Service type backfill changed the number of appointments or requirements';
  END IF;

  SELECT
    (SELECT count(*) FROM public.appointments
       WHERE service_type_id IS NULL AND btrim(COALESCE(service_type, '')) <> '')
    + (SELECT count(*) FROM public.sacrament_requirements
       WHERE service_type_id IS NULL AND btrim(COALESCE(service_type, '')) <> '')
  INTO v_unlinked;

  IF v_unlinked > 0 THEN
    RAISE EXCEPTION 'Service type backfill left % rows unlinked', v_unlinked;
  END IF;

  RAISE NOTICE 'Service type backfill: %', v_result;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
