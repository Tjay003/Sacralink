-- =========================================================
-- MIGRATION 091: QR Verification Codes for Church Offertory
-- =========================================================
-- Implements 6-digit OTP verification table and verification RPC
-- with visual reference code matching for offertory QR code and
-- payment detail alterations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create table public.qr_verification_codes
CREATE TABLE IF NOT EXISTS public.qr_verification_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reference_code text NOT NULL,
    otp_hash text NOT NULL,
    channel text NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
    verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes for fast lookup and expiration pruning
CREATE INDEX IF NOT EXISTS idx_qr_verification_codes_lookup
    ON public.qr_verification_codes(church_id, reference_code);

CREATE INDEX IF NOT EXISTS idx_qr_verification_codes_expires_at
    ON public.qr_verification_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_qr_verification_codes_user
    ON public.qr_verification_codes(user_id);

-- 3. Row Level Security
ALTER TABLE public.qr_verification_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view their church verification codes" ON public.qr_verification_codes;

CREATE POLICY "Admins can view their church verification codes"
    ON public.qr_verification_codes
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.role = 'super_admin'
                OR (profiles.role = 'church_admin' AND profiles.assigned_church_id = qr_verification_codes.church_id)
                OR (profiles.role = 'admin' AND profiles.church_id = qr_verification_codes.church_id)
            )
        )
    );

-- 4. Verification RPC function
CREATE OR REPLACE FUNCTION public.verify_qr_otp(
    p_church_id uuid,
    p_reference_code text,
    p_otp text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_record public.qr_verification_codes%ROWTYPE;
    v_remaining integer;
    v_hashed_input text;
BEGIN
    -- 1. Require authenticated session
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    -- 2. Validate admin authority for church
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_uid
        AND (
            role = 'super_admin'
            OR (role = 'church_admin' AND assigned_church_id = p_church_id)
            OR (role = 'admin' AND church_id = p_church_id)
        )
    ) THEN
        RAISE EXCEPTION 'You do not have administrative permissions for this church.' USING ERRCODE = '42501';
    END IF;

    -- 3. Find matching active verification record
    SELECT * INTO v_record
    FROM public.qr_verification_codes
    WHERE church_id = p_church_id
      AND reference_code = UPPER(TRIM(p_reference_code))
      AND verified_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_record.id IS NULL THEN
        RAISE EXCEPTION 'Verification code not found or already verified.';
    END IF;

    -- 4. Expiration check
    IF v_record.expires_at <= now() THEN
        RAISE EXCEPTION 'Verification code has expired. Please request a new code.';
    END IF;

    -- 5. Brute force / max attempts check
    IF v_record.attempts >= 5 THEN
        RAISE EXCEPTION 'Maximum verification attempts exceeded. Please request a new code.';
    END IF;

    -- 6. Verify hash
    v_hashed_input := lower(encode(digest(TRIM(p_otp), 'sha256'), 'hex'));

    IF v_hashed_input <> lower(v_record.otp_hash) THEN
        UPDATE public.qr_verification_codes
        SET attempts = attempts + 1
        WHERE id = v_record.id;

        v_remaining := 5 - (v_record.attempts + 1);
        IF v_remaining <= 0 THEN
            RAISE EXCEPTION 'Invalid verification code. Maximum attempts reached. Please request a new code.';
        ELSE
            RAISE EXCEPTION 'Invalid verification code. % attempt(s) remaining.', v_remaining;
        END IF;
    END IF;

    -- 7. Successful verification
    UPDATE public.qr_verification_codes
    SET verified_at = now()
    WHERE id = v_record.id;

    -- 8. Write non-fatal audit log in public.activity_logs
    BEGIN
        INSERT INTO public.activity_logs (
            user_id,
            church_id,
            action,
            entity_type,
            entity_id,
            metadata
        ) VALUES (
            v_uid,
            p_church_id,
            'verify_offertory_qr_otp',
            'churches',
            p_church_id,
            jsonb_build_object(
                'verification_id', v_record.id,
                'reference_code', v_record.reference_code,
                'channel', v_record.channel,
                'verified_at', now()
            )
        );
    EXCEPTION
        WHEN OTHERS THEN
            -- Activity logging is non-fatal
            NULL;
    END;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_qr_otp(uuid, text, text) TO authenticated;
