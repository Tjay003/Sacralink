-- 074: Everyone except the Super Admin can delete their own account.
-- delete_own_account() wraps anonymize_user (066) after three safeguards; can_delete_own_account() runs the same
-- checks read-only so the profile page can warn before the confirmation step.

CREATE OR REPLACE FUNCTION public.own_account_block(p_user_id uuid)
RETURNS TABLE (code text, message text, sqlstate text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_count integer;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    IF v_profile.id IS NULL THEN
        RETURN QUERY SELECT 'not_found'::text, 'User not found'::text, 'P0002'::text;
        RETURN;
    END IF;

    IF v_profile.role::text = 'super_admin' THEN
        RETURN QUERY SELECT 'super_admin'::text, 'The Super Admin account cannot be deleted'::text, '42501'::text;
        RETURN;
    END IF;

    -- Last Church Admin of a church (same predicate as the guard in set_user_role, migration 063)
    IF v_profile.role::text = 'church_admin' AND v_profile.assigned_church_id IS NOT NULL
       AND NOT EXISTS (
            SELECT 1 FROM public.profiles o
            WHERE o.role::text = 'church_admin' AND o.assigned_church_id = v_profile.assigned_church_id
              AND o.id <> p_user_id AND o.deleted_at IS NULL
       ) THEN
        RETURN QUERY SELECT 'last_church_admin'::text, 'Name a successor Church Admin before deleting your account'::text, '23514'::text;
        RETURN;
    END IF;

    -- A priest with upcoming approved appointments (appointments.priest_id is the assigned celebrant)
    IF v_profile.role::text = 'priest' OR COALESCE(v_profile.is_priest, false) THEN
        SELECT count(*) INTO v_count
        FROM public.appointments a
        WHERE a.priest_id = p_user_id
          AND a.status = 'approved'
          AND a.appointment_date >= (now() AT TIME ZONE 'Asia/Manila')::date;
        IF v_count > 0 THEN
            RETURN QUERY SELECT 'upcoming_appointments'::text,
                format('You have %s upcoming %s. Ask the parish office to reassign them first',
                       v_count, CASE WHEN v_count = 1 THEN 'appointment' ELSE 'appointments' END),
                '55000'::text;
            RETURN;
        END IF;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.own_account_block(uuid) FROM PUBLIC, anon, authenticated;

-- Read-only check for the signed-in user.
CREATE OR REPLACE FUNCTION public.can_delete_own_account()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_block record;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
    END IF;
    PERFORM public.assert_account_active();
    SELECT * INTO v_block FROM public.own_account_block(v_uid);
    IF v_block.code IS NULL THEN
        RETURN jsonb_build_object('can_delete', true, 'code', NULL, 'message', NULL);
    END IF;
    RETURN jsonb_build_object('can_delete', false, 'code', v_block.code, 'message', v_block.message);
END;
$$;

REVOKE ALL ON FUNCTION public.can_delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_delete_own_account() TO authenticated;

-- The deletion itself.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_church uuid;
    v_block record;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
    END IF;
    PERFORM public.assert_account_active();

    -- Same per-church lock as set_user_role so two Church Admins cannot delete themselves at the same moment.
    SELECT assigned_church_id INTO v_church FROM public.profiles WHERE id = v_uid;
    IF v_church IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('set_user_role:' || v_church::text));
    END IF;

    SELECT * INTO v_block FROM public.own_account_block(v_uid);
    IF v_block.code IS NOT NULL THEN
        RAISE EXCEPTION '%', v_block.message USING ERRCODE = v_block.sqlstate;
    END IF;

    PERFORM public.anonymize_user(v_uid, v_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

NOTIFY pgrst, 'reload schema';
