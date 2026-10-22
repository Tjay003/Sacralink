-- =========================================================
-- MIGRATION 063: Database-enforced role changes
-- =========================================================
-- Role, church and clergy changes on profiles can only happen through public.set_user_role (and the
-- Super Admin ownership transfer). A BEFORE UPDATE trigger blocks every other path from a signed-in user,
-- including a direct REST PATCH. Sessions without a user (service role, SQL editor, migrations) are not affected.
-- Idempotent: safe to run more than once.

-- 1. Staff cleanup hook. Internal only. Later tickets extend it (ticket 13: unassign the person's church tickets;
--    anonymize_user calls it too). Removes the person from the staff channel(s) of the church they stopped serving.
--    Their own open platform tickets are never touched.
CREATE OR REPLACE FUNCTION public.cleanup_staff_assignments(p_user_id uuid, p_church_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.conversation_participants cp
    USING public.conversations c
    WHERE cp.conversation_id = c.id
      AND cp.user_id = p_user_id
      AND c.type = 'channel'
      AND c.church_id = p_church_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_staff_assignments(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 2. The only sanctioned way to change a role.
CREATE OR REPLACE FUNCTION public.set_user_role(
    p_user_id uuid,
    p_role public.user_role,
    p_church_id uuid DEFAULT NULL,
    p_is_priest boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_caller public.profiles%ROWTYPE;
    v_target public.profiles%ROWTYPE;
    v_old_church uuid;
    v_new_church uuid;
    v_new_priest boolean;
    v_old_staff boolean;
    v_leaves_church boolean;
    v_staff_roles constant text[] := ARRAY['volunteer', 'priest', 'church_admin'];
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
    END IF;

    IF p_role::text NOT IN ('user', 'volunteer', 'priest', 'church_admin') THEN
        RAISE EXCEPTION 'That role cannot be assigned here' USING ERRCODE = '42501';
    END IF;

    -- Lock both rows in a fixed order so two people changing each other cannot deadlock.
    PERFORM 1 FROM public.profiles WHERE id IN (v_caller_id, p_user_id) ORDER BY id FOR UPDATE;
    SELECT * INTO v_caller FROM public.profiles WHERE id = v_caller_id;
    SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id;

    IF v_caller.id IS NULL OR v_caller.role::text NOT IN ('super_admin', 'church_admin') THEN
        RAISE EXCEPTION 'Only a Super Admin or a Church Admin can change roles' USING ERRCODE = '42501';
    END IF;
    IF v_target.id IS NULL THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_target.role::text IN ('super_admin', 'admin') THEN
        RAISE EXCEPTION 'The Super Admin role can only be moved with Transfer Ownership' USING ERRCODE = '42501';
    END IF;

    v_old_church := v_target.assigned_church_id;

    IF v_caller.role::text = 'church_admin' THEN
        v_new_church := COALESCE(v_caller.assigned_church_id, v_caller.church_id);
        IF v_new_church IS NULL THEN
            RAISE EXCEPTION 'You are not assigned to a church' USING ERRCODE = '42501';
        END IF;
        IF p_user_id = v_caller_id THEN
            RAISE EXCEPTION 'You cannot change your own role' USING ERRCODE = '42501';
        END IF;
        IF NOT (v_old_church = v_new_church OR (v_target.role::text = 'user' AND v_old_church IS NULL)) THEN
            RAISE EXCEPTION 'That user does not belong to your church' USING ERRCODE = '42501';
        END IF;
        -- A demotion keeps the church the person is already attached to.
        IF p_role::text = 'user' THEN
            v_new_church := v_old_church;
        END IF;
    ELSE
        v_new_church := COALESCE(p_church_id, v_old_church);
        IF p_role::text = ANY (v_staff_roles) AND v_new_church IS NULL THEN
            RAISE EXCEPTION 'A church is required for staff roles' USING ERRCODE = '22023';
        END IF;
    END IF;

    -- Serialize all role changes within one church so the last-Church-Admin guard cannot be raced.
    IF v_old_church IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('set_user_role:' || v_old_church::text));
    END IF;
    IF v_new_church IS NOT NULL AND v_new_church IS DISTINCT FROM v_old_church THEN
        PERFORM pg_advisory_xact_lock(hashtext('set_user_role:' || v_new_church::text));
    END IF;

    v_old_staff := v_target.role::text = ANY (v_staff_roles);
    v_leaves_church := p_role::text = 'user' OR v_new_church IS DISTINCT FROM v_old_church;

    -- Last Church Admin guard
    IF v_target.role::text = 'church_admin' AND v_old_church IS NOT NULL
       AND (p_role::text <> 'church_admin' OR v_new_church IS DISTINCT FROM v_old_church)
       AND NOT EXISTS (
            SELECT 1 FROM public.profiles o
            WHERE o.role::text = 'church_admin' AND o.assigned_church_id = v_old_church AND o.id <> p_user_id
       ) THEN
        RAISE EXCEPTION 'A church must keep at least one Church Admin' USING ERRCODE = '23514';
    END IF;

    v_new_priest := CASE p_role::text
        WHEN 'priest' THEN true
        WHEN 'church_admin' THEN COALESCE(p_is_priest, v_target.is_priest, false)
        ELSE false
    END;

    PERFORM set_config('app.role_change_ok', '1', true);
    UPDATE public.profiles
    SET role = p_role,
        assigned_church_id = v_new_church,
        church_id = CASE WHEN p_role::text = ANY (v_staff_roles) THEN v_new_church ELSE church_id END,
        is_priest = v_new_priest,
        updated_at = NOW()
    WHERE id = p_user_id;
    PERFORM set_config('app.role_change_ok', '', true);

    INSERT INTO public.activity_logs (user_id, church_id, action, entity_type, entity_id, metadata)
    VALUES (
        v_caller_id,
        COALESCE(v_new_church, v_old_church),
        'set_user_role',
        'profiles',
        p_user_id,
        jsonb_build_object(
            'before_role', v_target.role,
            'after_role', p_role,
            'before_church_id', v_old_church,
            'after_church_id', v_new_church
        )
    );

    -- Staff cleanup (spec decision 37): only when the person stops being staff of the church they served.
    IF v_old_staff AND v_old_church IS NOT NULL AND v_leaves_church THEN
        PERFORM public.cleanup_staff_assignments(p_user_id, v_old_church);
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, public.user_role, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.user_role, uuid, boolean) TO authenticated;

-- 3. Close the direct path.
CREATE OR REPLACE FUNCTION public.guard_profile_role_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.uid() IS NULL OR COALESCE(current_setting('app.role_change_ok', true), '') = '1' THEN
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

DROP TRIGGER IF EXISTS trg_guard_profile_role_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_role_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role_columns();

-- Church admins keep write access to the profiles of their own church only (the trigger protects the role columns).
DROP POLICY IF EXISTS "Church admins can update their church members" ON public.profiles;
CREATE POLICY "Church admins can update their church members"
ON public.profiles FOR UPDATE
USING (
    public.get_current_user_role() = 'church_admin'
    AND assigned_church_id = public.get_current_user_church_id()
)
WITH CHECK (
    public.get_current_user_role() = 'church_admin'
    AND assigned_church_id = public.get_current_user_church_id()
);

-- 4. transfer_super_admin is the other sanctioned path: same body as migration 062, plus the permission flag.
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

    SELECT role INTO caller_role FROM public.profiles WHERE id = caller_id;
    IF caller_role IS NULL OR caller_role != 'super_admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Only the current Super Admin can transfer ownership');
    END IF;

    IF caller_id = target_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target user is already the Super Admin');
    END IF;

    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = target_user_id) INTO target_exists;
    IF NOT target_exists THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target user not found');
    END IF;

    PERFORM set_config('app.role_change_ok', '1', true);

    UPDATE public.profiles
    SET role = 'user', updated_at = NOW()
    WHERE id = caller_id;

    UPDATE public.profiles
    SET role = 'super_admin', assigned_church_id = NULL, church_id = NULL, updated_at = NOW()
    WHERE id = target_user_id;

    PERFORM set_config('app.role_change_ok', '', true);

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
