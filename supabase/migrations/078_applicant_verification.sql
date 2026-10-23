-- =========================================================
-- MIGRATION 078: Applicant verification for parish applications
-- =========================================================
-- A parish application now carries two verifications: the parish (existing) and the applicant (this migration).
-- The applicant becomes Church Admin only when both pass, and the whole approval (church, role change, application
-- update) happens inside public.approve_parish_application so a half-finished state cannot promote anyone.
-- ID images and selfies live in a PRIVATE bucket and are removed after the retention date.
-- Idempotent: safe to run more than once.

-- 1. Applicant columns. The existing `status` keeps meaning the parish part.
ALTER TABLE public.parish_applications
    ADD COLUMN IF NOT EXISTS applicant_legal_name text,
    ADD COLUMN IF NOT EXISTS applicant_position text,
    ADD COLUMN IF NOT EXISTS applicant_phone text,
    ADD COLUMN IF NOT EXISTS applicant_id_path text,
    ADD COLUMN IF NOT EXISTS applicant_selfie_path text,
    ADD COLUMN IF NOT EXISTS applicant_status text NOT NULL DEFAULT 'not_submitted',
    ADD COLUMN IF NOT EXISTS applicant_rejection_reason text,
    ADD COLUMN IF NOT EXISTS applicant_checklist jsonb,
    ADD COLUMN IF NOT EXISTS applicant_reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS applicant_reviewed_at timestamptz,
    ADD COLUMN IF NOT EXISTS applicant_attempts integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS applicant_files_delete_after timestamptz;

ALTER TABLE public.parish_applications DROP CONSTRAINT IF EXISTS parish_applications_applicant_status_check;
ALTER TABLE public.parish_applications ADD CONSTRAINT parish_applications_applicant_status_check
    CHECK (applicant_status IN ('not_submitted', 'pending', 'passed', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_parish_applications_files_delete_after
    ON public.parish_applications(applicant_files_delete_after)
    WHERE applicant_files_delete_after IS NOT NULL;

-- 2. Column guard and retention clock.
--    A signed-in user (applicant, Super Admin, leftover admin) cannot touch the applicant columns, or move the parish
--    part to verified_active, except through the functions below, which set app.applicant_verification_ok.
--    Sessions without a user (service role, SQL editor, migrations) are not restricted.
CREATE OR REPLACE FUNCTION public.guard_parish_application_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_trusted boolean := auth.uid() IS NULL OR COALESCE(current_setting('app.applicant_verification_ok', true), '') = '1';
BEGIN
    IF NOT v_trusted THEN
        IF TG_OP = 'INSERT' THEN
            -- A new application always starts open with an empty applicant part.
            NEW.status := 'pending';
            NEW.applicant_legal_name := NULL;
            NEW.applicant_position := NULL;
            NEW.applicant_phone := NULL;
            NEW.applicant_id_path := NULL;
            NEW.applicant_selfie_path := NULL;
            NEW.applicant_status := 'not_submitted';
            NEW.applicant_rejection_reason := NULL;
            NEW.applicant_checklist := NULL;
            NEW.applicant_reviewed_by := NULL;
            NEW.applicant_reviewed_at := NULL;
            NEW.applicant_attempts := 0;
            NEW.applicant_files_delete_after := NULL;
            NEW.church_id := NULL;
        ELSE
            IF NEW.applicant_legal_name IS DISTINCT FROM OLD.applicant_legal_name
               OR NEW.applicant_position IS DISTINCT FROM OLD.applicant_position
               OR NEW.applicant_phone IS DISTINCT FROM OLD.applicant_phone
               OR NEW.applicant_id_path IS DISTINCT FROM OLD.applicant_id_path
               OR NEW.applicant_selfie_path IS DISTINCT FROM OLD.applicant_selfie_path
               OR NEW.applicant_status IS DISTINCT FROM OLD.applicant_status
               OR NEW.applicant_rejection_reason IS DISTINCT FROM OLD.applicant_rejection_reason
               OR NEW.applicant_checklist IS DISTINCT FROM OLD.applicant_checklist
               OR NEW.applicant_reviewed_by IS DISTINCT FROM OLD.applicant_reviewed_by
               OR NEW.applicant_reviewed_at IS DISTINCT FROM OLD.applicant_reviewed_at
               OR NEW.applicant_attempts IS DISTINCT FROM OLD.applicant_attempts
               OR NEW.applicant_files_delete_after IS DISTINCT FROM OLD.applicant_files_delete_after THEN
                RAISE EXCEPTION 'Applicant verification can only be changed through its own functions' USING ERRCODE = '42501';
            END IF;
            IF NEW.status = 'verified_active' AND OLD.status IS DISTINCT FROM 'verified_active' THEN
                RAISE EXCEPTION 'A parish application can only be approved through approve_parish_application' USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    -- Retention clock: once the application is decided (approved, rejected, or the applicant part is finally rejected),
    -- the ID images are scheduled for deletion 30 days later. The clock starts once.
    IF NEW.applicant_files_delete_after IS NULL
       AND (NEW.applicant_id_path IS NOT NULL OR NEW.applicant_selfie_path IS NOT NULL)
       AND (
            NEW.status IN ('verified_active', 'rejected')
            OR (NEW.applicant_status = 'rejected' AND NEW.applicant_attempts >= 3)
       ) THEN
        NEW.applicant_files_delete_after := now() + interval '30 days';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_parish_application_columns ON public.parish_applications;
CREATE TRIGGER trg_guard_parish_application_columns
    BEFORE INSERT OR UPDATE ON public.parish_applications
    FOR EACH ROW EXECUTE FUNCTION public.guard_parish_application_columns();

-- 3. Private storage bucket. Layout: <applicant_id>/<file>. Nothing here is ever a public URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'applicant-verification',
    'applicant-verification',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- True while the signed-in user has an application that is still open (the parish part is undecided).
CREATE OR REPLACE FUNCTION public.has_open_parish_application()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT auth.uid() IS NOT NULL
       AND NOT public.is_account_blocked()
       AND EXISTS (
            SELECT 1 FROM public.parish_applications
            WHERE applicant_id = auth.uid() AND status IN ('pending', 'under_review')
       );
$$;

REVOKE ALL ON FUNCTION public.has_open_parish_application() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_open_parish_application() TO authenticated;

DROP POLICY IF EXISTS "Applicants upload own verification files" ON storage.objects;
CREATE POLICY "Applicants upload own verification files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'applicant-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.has_open_parish_application()
);

DROP POLICY IF EXISTS "Applicants read own verification files" ON storage.objects;
CREATE POLICY "Applicants read own verification files"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'applicant-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.has_open_parish_application()
);

DROP POLICY IF EXISTS "Super Admin reads verification files" ON storage.objects;
CREATE POLICY "Super Admin reads verification files"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'applicant-verification'
    AND public.get_current_user_role()::text = 'super_admin'
);

-- 4. The applicant submits (or resubmits) their part. Three attempts in total.
CREATE OR REPLACE FUNCTION public.submit_applicant_verification(
    p_application_id uuid,
    p_legal_name text,
    p_position text,
    p_phone text,
    p_id_path text,
    p_selfie_path text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_app public.parish_applications%ROWTYPE;
    v_max_attempts constant integer := 3;
BEGIN
    PERFORM public.assert_account_active();

    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
    END IF;

    SELECT * INTO v_app FROM public.parish_applications WHERE id = p_application_id FOR UPDATE;
    IF v_app.id IS NULL OR v_app.applicant_id IS DISTINCT FROM v_uid THEN
        RAISE EXCEPTION 'Application not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_app.status NOT IN ('pending', 'under_review') THEN
        RAISE EXCEPTION 'This application is already decided' USING ERRCODE = '22023';
    END IF;
    IF v_app.applicant_status NOT IN ('not_submitted', 'rejected') THEN
        RAISE EXCEPTION 'Your applicant details are already submitted' USING ERRCODE = '22023';
    END IF;
    IF v_app.applicant_attempts >= v_max_attempts THEN
        RAISE EXCEPTION 'You have used all % attempts. Please start a new application.', v_max_attempts USING ERRCODE = '22023';
    END IF;

    IF COALESCE(btrim(p_legal_name), '') = '' OR COALESCE(btrim(p_position), '') = '' OR COALESCE(btrim(p_phone), '') = '' THEN
        RAISE EXCEPTION 'Legal name, position and mobile number are required' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(p_id_path, '') = '' OR COALESCE(p_selfie_path, '') = '' THEN
        RAISE EXCEPTION 'A photo ID and a selfie holding it are required' USING ERRCODE = '22023';
    END IF;
    IF split_part(p_id_path, '/', 1) <> v_uid::text OR split_part(p_selfie_path, '/', 1) <> v_uid::text THEN
        RAISE EXCEPTION 'Files must be uploaded to your own folder' USING ERRCODE = '42501';
    END IF;

    PERFORM set_config('app.applicant_verification_ok', '1', true);
    UPDATE public.parish_applications
    SET applicant_legal_name = btrim(p_legal_name),
        applicant_position = btrim(p_position),
        applicant_phone = btrim(p_phone),
        applicant_id_path = p_id_path,
        applicant_selfie_path = p_selfie_path,
        applicant_status = 'pending',
        applicant_rejection_reason = NULL,
        applicant_attempts = applicant_attempts + 1,
        updated_at = now()
    WHERE id = p_application_id;
    PERFORM set_config('app.applicant_verification_ok', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_applicant_verification(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_applicant_verification(uuid, text, text, text, text, text) TO authenticated;

-- 5. The Super Admin records the applicant outcome. A rejection needs a reason of 10+ characters.
CREATE OR REPLACE FUNCTION public.review_applicant_verification(
    p_application_id uuid,
    p_passed boolean,
    p_checklist jsonb,
    p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_app public.parish_applications%ROWTYPE;
    v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
    PERFORM public.assert_account_active();

    IF v_uid IS NULL OR public.get_current_user_role()::text <> 'super_admin' THEN
        RAISE EXCEPTION 'Only the Super Admin can review an applicant' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_app FROM public.parish_applications WHERE id = p_application_id FOR UPDATE;
    IF v_app.id IS NULL THEN
        RAISE EXCEPTION 'Application not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_app.status NOT IN ('pending', 'under_review') THEN
        RAISE EXCEPTION 'This application is already decided' USING ERRCODE = '22023';
    END IF;
    IF v_app.applicant_status <> 'pending' THEN
        RAISE EXCEPTION 'There is no applicant submission waiting for review' USING ERRCODE = '22023';
    END IF;
    IF NOT p_passed AND char_length(v_reason) < 10 THEN
        RAISE EXCEPTION 'A rejection needs a reason of at least 10 characters' USING ERRCODE = '22023';
    END IF;

    PERFORM set_config('app.applicant_verification_ok', '1', true);
    UPDATE public.parish_applications
    SET applicant_status = CASE WHEN p_passed THEN 'passed' ELSE 'rejected' END,
        applicant_checklist = p_checklist,
        applicant_rejection_reason = CASE WHEN p_passed THEN NULL ELSE v_reason END,
        applicant_reviewed_by = v_uid,
        applicant_reviewed_at = now(),
        updated_at = now()
    WHERE id = p_application_id;
    PERFORM set_config('app.applicant_verification_ok', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.review_applicant_verification(uuid, boolean, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_applicant_verification(uuid, boolean, jsonb, text) TO authenticated;

-- 6. Approval: both parts must have passed. Church, role change and application update are one transaction.
--    The caller still seeds the default sacrament requirements when `church_created` is true.
CREATE OR REPLACE FUNCTION public.approve_parish_application(
    p_application_id uuid,
    p_checklist jsonb
)
RETURNS TABLE (church_id uuid, church_created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_app public.parish_applications%ROWTYPE;
    v_church_id uuid;
    v_created boolean := false;
    v_role text;
    v_next_role public.user_role;
BEGIN
    PERFORM public.assert_account_active();

    IF v_uid IS NULL OR public.get_current_user_role()::text <> 'super_admin' THEN
        RAISE EXCEPTION 'Only the Super Admin can approve a parish application' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_app FROM public.parish_applications WHERE id = p_application_id FOR UPDATE;
    IF v_app.id IS NULL THEN
        RAISE EXCEPTION 'Application not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_app.status = 'verified_active' THEN
        RAISE EXCEPTION 'This application is already approved' USING ERRCODE = '22023';
    END IF;
    IF v_app.applicant_status <> 'passed' THEN
        RAISE EXCEPTION 'The applicant must be verified before the parish can be approved' USING ERRCODE = '22023';
    END IF;

    v_church_id := v_app.church_id;
    IF v_church_id IS NULL THEN
        INSERT INTO public.churches (
            name, address, contact_number, email, description, latitude, longitude,
            gcash_number, maya_number, status, is_active
        )
        VALUES (
            v_app.parish_name, v_app.address, v_app.contact_number, v_app.email, v_app.description,
            v_app.latitude, v_app.longitude, v_app.gcash_number, v_app.maya_number, 'verified_active', true
        )
        RETURNING id INTO v_church_id;
        v_created := true;
    ELSE
        UPDATE public.churches
        SET status = 'verified_active',
            is_active = true,
            gcash_number = v_app.gcash_number,
            maya_number = v_app.maya_number,
            latitude = v_app.latitude,
            longitude = v_app.longitude
        WHERE id = v_church_id;
    END IF;

    -- The applicant keeps a staff role they already hold; anyone else becomes Church Admin. A Super Admin is left alone.
    IF v_app.applicant_id IS NOT NULL THEN
        SELECT role::text INTO v_role FROM public.profiles WHERE id = v_app.applicant_id;
        IF v_role IS DISTINCT FROM 'super_admin' THEN
            v_next_role := CASE
                WHEN v_role IN ('volunteer', 'priest', 'church_admin') THEN v_role::public.user_role
                ELSE 'church_admin'::public.user_role
            END;
            PERFORM public.set_user_role(v_app.applicant_id, v_next_role, v_church_id);
        END IF;
    END IF;

    PERFORM set_config('app.applicant_verification_ok', '1', true);
    UPDATE public.parish_applications
    SET status = 'verified_active',
        checklist = p_checklist,
        reviewed_by = v_uid,
        reviewed_at = now(),
        church_id = v_church_id,
        updated_at = now()
    WHERE id = p_application_id;
    PERFORM set_config('app.applicant_verification_ok', '', true);

    church_id := v_church_id;
    church_created := v_created;
    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_parish_application(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_parish_application(uuid, jsonb) TO authenticated;

-- 7. Retention. Deleting rows from storage.objects with SQL would leave the files on disk, so removal is two steps run
--    by a service-role job (scripts/purge-applicant-files.mjs): list what is due, delete the files through the Storage
--    API, then record it. Decision 2: files go 30 days after approval or final rejection; the checklist and reviewer stay.
CREATE OR REPLACE FUNCTION public.applicant_files_due_for_purge()
RETURNS TABLE (application_id uuid, file_path text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT a.id, p.path
    FROM public.parish_applications a
    CROSS JOIN LATERAL (VALUES (a.applicant_id_path), (a.applicant_selfie_path)) AS p(path)
    WHERE a.applicant_files_delete_after IS NOT NULL
      AND a.applicant_files_delete_after <= now()
      AND p.path IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.mark_applicant_files_purged(p_application_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE public.parish_applications
    SET applicant_id_path = NULL,
        applicant_selfie_path = NULL,
        updated_at = now()
    WHERE id = ANY (p_application_ids)
      AND applicant_files_delete_after IS NOT NULL
      AND applicant_files_delete_after <= now();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.applicant_files_due_for_purge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_applicant_files_purged(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.applicant_files_due_for_purge() TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_applicant_files_purged(uuid[]) TO service_role;
