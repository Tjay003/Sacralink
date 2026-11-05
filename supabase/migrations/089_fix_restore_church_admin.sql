-- Migration: 089_fix_restore_church_admin.sql
-- Description: Allow church auto-restore and restore if former admin or eligible user is assigned to p_church_id or null, and enforce SJDM coordinate boundaries constraint.

-- 1. Update church_restore_status function
CREATE OR REPLACE FUNCTION public.church_restore_status(p_church_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_church public.churches%ROWTYPE;
    v_admin record;
    v_can_auto_restore boolean := false;
    v_admin_info jsonb := NULL;
BEGIN
    IF auth.uid() IS NULL OR public.get_current_user_role()::text <> 'super_admin' THEN
        RAISE EXCEPTION 'Only the Super Admin can check church restore status' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_church FROM public.churches WHERE id = p_church_id;
    IF v_church.id IS NULL THEN
        RAISE EXCEPTION 'Church not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_church.archived_admin_id IS NOT NULL THEN
        SELECT p.id,
               p.full_name,
               p.email,
               p.role::text,
               COALESCE(p.assigned_church_id, p.church_id) AS current_church_id,
               ch.name AS current_church_name,
               p.deleted_at,
               p.archived_at
        INTO v_admin
        FROM public.profiles p
        LEFT JOIN public.churches ch ON ch.id = COALESCE(p.assigned_church_id, p.church_id)
        WHERE p.id = v_church.archived_admin_id;

        IF v_admin.id IS NOT NULL THEN
            IF v_admin.role = 'user'
               AND (v_admin.current_church_id IS NULL OR v_admin.current_church_id = p_church_id)
               AND v_admin.deleted_at IS NULL
               AND v_admin.archived_at IS NULL THEN
                v_can_auto_restore := true;
            ELSE
                v_can_auto_restore := false;
            END IF;

            v_admin_info := jsonb_build_object(
                'id', v_admin.id,
                'full_name', v_admin.full_name,
                'email', v_admin.email,
                'current_role', v_admin.role,
                'current_church_id', v_admin.current_church_id,
                'current_church_name', v_admin.current_church_name
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'can_auto_restore', v_can_auto_restore,
        'archived_admin', v_admin_info
    );
END;
$$;

REVOKE ALL ON FUNCTION public.church_restore_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.church_restore_status(uuid) TO authenticated;

-- 2. Update restore_church function
CREATE OR REPLACE FUNCTION public.restore_church(p_church_id uuid, p_new_admin_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_church public.churches%ROWTYPE;
    v_admin_profile public.profiles%ROWTYPE;
    v_target_admin_id uuid;
BEGIN
    PERFORM public.assert_account_active();

    IF auth.uid() IS NULL OR public.get_current_user_role()::text <> 'super_admin' THEN
        RAISE EXCEPTION 'Only the Super Admin can restore a church' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_church FROM public.churches WHERE id = p_church_id;
    IF v_church.id IS NULL THEN
        RAISE EXCEPTION 'Church not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_church.status <> 'archived' THEN
        RAISE EXCEPTION 'This church is not archived' USING ERRCODE = '22023';
    END IF;

    -- Determine which admin to assign
    IF p_new_admin_id IS NULL THEN
        IF v_church.archived_admin_id IS NULL THEN
            RAISE EXCEPTION 'No former Church Admin recorded. Please select a new Church Admin.' USING ERRCODE = '22023';
        END IF;

        SELECT * INTO v_admin_profile FROM public.profiles WHERE id = v_church.archived_admin_id;
        IF v_admin_profile.id IS NULL
           OR v_admin_profile.deleted_at IS NOT NULL
           OR v_admin_profile.archived_at IS NOT NULL
           OR v_admin_profile.role::text <> 'user'
           OR (COALESCE(v_admin_profile.assigned_church_id, v_admin_profile.church_id) IS NOT NULL
               AND COALESCE(v_admin_profile.assigned_church_id, v_admin_profile.church_id) <> p_church_id) THEN
            RAISE EXCEPTION 'Former Church Admin is no longer available. Please select a replacement Church Admin.' USING ERRCODE = '23514';
        END IF;

        v_target_admin_id := v_admin_profile.id;
    ELSE
        SELECT * INTO v_admin_profile FROM public.profiles WHERE id = p_new_admin_id;
        IF v_admin_profile.id IS NULL THEN
            RAISE EXCEPTION 'Selected user not found' USING ERRCODE = 'P0002';
        END IF;
        IF v_admin_profile.deleted_at IS NOT NULL OR v_admin_profile.archived_at IS NOT NULL THEN
            RAISE EXCEPTION 'Selected user is deleted or archived' USING ERRCODE = '22023';
        END IF;
        IF v_admin_profile.role::text <> 'user'
           OR (COALESCE(v_admin_profile.assigned_church_id, v_admin_profile.church_id) IS NOT NULL
               AND COALESCE(v_admin_profile.assigned_church_id, v_admin_profile.church_id) <> p_church_id) THEN
            RAISE EXCEPTION 'Selected user must be an active Parishioner without an assigned church' USING ERRCODE = '22023';
        END IF;

        v_target_admin_id := p_new_admin_id;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('set_user_role:' || p_church_id::text));

    PERFORM set_config('app.role_change_ok', '1', true);
    UPDATE public.profiles
    SET role = 'church_admin',
        assigned_church_id = p_church_id,
        church_id = p_church_id,
        updated_at = now()
    WHERE id = v_target_admin_id;
    PERFORM set_config('app.role_change_ok', '', true);

    UPDATE public.churches
    SET status = 'active',
        is_active = true,
        archived_at = NULL,
        archived_admin_id = NULL,
        updated_at = now()
    WHERE id = p_church_id;

    PERFORM public.ensure_church_staff_channel(p_church_id);

    INSERT INTO public.activity_logs (user_id, church_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), p_church_id, 'restore_church', 'churches', p_church_id,
            jsonb_build_object('admin_id', v_target_admin_id));

    RETURN jsonb_build_object('success', true, 'church_id', p_church_id, 'admin_id', v_target_admin_id);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_church(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_church(uuid, uuid) TO authenticated;

-- 3. Coordinate boundary check constraint for churches
ALTER TABLE public.churches DROP CONSTRAINT IF EXISTS churches_coordinates_sjdm_check;
ALTER TABLE public.churches ADD CONSTRAINT churches_coordinates_sjdm_check CHECK (
    (latitude IS NULL AND longitude IS NULL) OR
    (latitude BETWEEN 14.7500 AND 14.9000 AND longitude BETWEEN 120.9800 AND 121.1600)
);
