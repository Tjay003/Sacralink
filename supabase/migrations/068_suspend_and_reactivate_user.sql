-- =========================================================
-- MIGRATION 068: Super Admin suspends and reactivates a user
-- =========================================================
-- A reversible middle step between "do nothing" and "delete". A suspended person cannot sign in or use the app;
-- role, church, appointments, donations, messages and the email all stay. The cut-off is instant because 066's
-- is_user_blocked() now also covers suspended_at, so the role helpers, conversation access, the restrictive
-- per-table policies and assert_account_active() pick it up with no further change.
-- Rollback: supabase/rollbacks/068_rollback_suspend_user.sql
-- Idempotent: safe to run more than once.

-- 1. Columns
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
    ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS suspension_reason text;
CREATE INDEX IF NOT EXISTS idx_profiles_suspended_at ON public.profiles (suspended_at) WHERE suspended_at IS NOT NULL;

-- 2. Blocked = deleted or suspended.
CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((SELECT p.deleted_at IS NOT NULL OR p.suspended_at IS NOT NULL FROM public.profiles p WHERE p.id = _user_id), false);
$$;

-- 3. Clients may never write the suspension columns; they change only through suspend_user / reactivate_user.
CREATE OR REPLACE FUNCTION public.guard_profile_role_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;
    IF COALESCE(current_setting('app.suspension_ok', true), '') <> '1'
       AND (NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
            OR NEW.suspended_by IS DISTINCT FROM OLD.suspended_by
            OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason) THEN
        RAISE EXCEPTION 'Suspension can only be changed through suspend_user and reactivate_user' USING ERRCODE = '42501';
    END IF;
    IF COALESCE(current_setting('app.role_change_ok', true), '') = '1' THEN
        RETURN NEW;
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.assigned_church_id IS DISTINCT FROM OLD.assigned_church_id
       OR NEW.church_id IS DISTINCT FROM OLD.church_id
       OR NEW.is_priest IS DISTINCT FROM OLD.is_priest THEN
        RAISE EXCEPTION 'Roles and church assignments can only be changed through set_user_role' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

-- 4. Suspend
CREATE OR REPLACE FUNCTION public.suspend_user(p_user_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_target public.profiles%ROWTYPE;
    v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
    PERFORM public.assert_account_active();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_caller_id AND role::text = 'super_admin') THEN
        RAISE EXCEPTION 'Only the Super Admin can suspend a user' USING ERRCODE = '42501';
    END IF;
    IF p_user_id = v_caller_id THEN
        RAISE EXCEPTION 'You cannot suspend your own account' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    IF v_target.id IS NULL THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_target.role::text = 'super_admin' THEN
        RAISE EXCEPTION 'The Super Admin cannot be suspended' USING ERRCODE = '42501';
    END IF;
    IF v_target.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'A deleted user cannot be suspended' USING ERRCODE = '42501';
    END IF;
    IF v_target.suspended_at IS NOT NULL THEN
        RAISE EXCEPTION 'This user is already suspended' USING ERRCODE = '42501';
    END IF;
    IF char_length(v_reason) < 10 THEN
        RAISE EXCEPTION 'Give a reason of at least 10 characters' USING ERRCODE = '22023';
    END IF;

    PERFORM set_config('app.suspension_ok', '1', true);
    UPDATE public.profiles
    SET suspended_at = NOW(), suspended_by = v_caller_id, suspension_reason = v_reason, updated_at = NOW()
    WHERE id = p_user_id;
    PERFORM set_config('app.suspension_ok', '', true);

    -- Ban the login (a far-future date: 'infinity' breaks GoTrue) and end every session so the next refresh fails.
    UPDATE auth.users SET banned_until = NOW() + interval '100 years', updated_at = NOW() WHERE id = p_user_id;
    DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;
    DELETE FROM auth.sessions WHERE user_id = p_user_id;

    INSERT INTO public.activity_logs (user_id, church_id, action, entity_type, entity_id, metadata)
    VALUES (v_caller_id, COALESCE(v_target.assigned_church_id, v_target.church_id), 'user_suspended', 'profiles', p_user_id,
            jsonb_build_object('reason', v_reason));
END;
$$;

-- 5. Reactivate
CREATE OR REPLACE FUNCTION public.reactivate_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_target public.profiles%ROWTYPE;
BEGIN
    PERFORM public.assert_account_active();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_caller_id AND role::text = 'super_admin') THEN
        RAISE EXCEPTION 'Only the Super Admin can reactivate a user' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    IF v_target.id IS NULL THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_target.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'A deleted user cannot be reactivated' USING ERRCODE = '42501';
    END IF;
    IF v_target.suspended_at IS NULL THEN
        RAISE EXCEPTION 'This user is not suspended' USING ERRCODE = '42501';
    END IF;

    PERFORM set_config('app.suspension_ok', '1', true);
    UPDATE public.profiles
    SET suspended_at = NULL, suspended_by = NULL, suspension_reason = NULL, updated_at = NOW()
    WHERE id = p_user_id;
    PERFORM set_config('app.suspension_ok', '', true);

    UPDATE auth.users SET banned_until = NULL, updated_at = NOW() WHERE id = p_user_id;

    INSERT INTO public.activity_logs (user_id, church_id, action, entity_type, entity_id, metadata)
    VALUES (v_caller_id, COALESCE(v_target.assigned_church_id, v_target.church_id), 'user_reactivated', 'profiles', p_user_id,
            jsonb_build_object('previous_reason', v_target.suspension_reason));
END;
$$;

REVOKE ALL ON FUNCTION public.suspend_user(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivate_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suspend_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_user(uuid) TO authenticated;

-- 6. Suspended clergy leave the celebrant pools (suspended people keep role and church, unlike deleted ones).
DO $$
DECLARE
    f record;
    v_def text;
    v_new text;
BEGIN
    FOR f IN
        SELECT p.oid, p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname IN ('get_parish_clergy', 'evaluate_parish_celebrants')
    LOOP
        v_def := pg_get_functiondef(f.oid);
        IF position('suspended_at' IN v_def) > 0 THEN
            CONTINUE;
        END IF;
        v_new := replace(v_def,
            'AND (COALESCE(pr.is_priest, false) OR pr.role::text = ''priest'')',
            'AND (COALESCE(pr.is_priest, false) OR pr.role::text = ''priest'') AND pr.suspended_at IS NULL');
        IF v_new = v_def THEN
            RAISE EXCEPTION 'Could not patch %: pool filter not found', f.proname;
        END IF;
        EXECUTE v_new;
    END LOOP;
END;
$$;
