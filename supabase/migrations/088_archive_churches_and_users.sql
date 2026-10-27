-- ============================================================================
-- Migration 088: Indefinite Archive & Safe Restore for Churches and
--                7-day Archive & Auto-Delete for Users
-- ============================================================================

-- 1. Church Archiving Schema -------------------------------------------------

ALTER TABLE public.churches DROP CONSTRAINT IF EXISTS churches_status_check;
ALTER TABLE public.churches ADD CONSTRAINT churches_status_check
  CHECK (status IN ('active', 'inactive', 'unverified', 'verified_active', 'archived'));

ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_churches_archived_at ON public.churches (archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_churches_status ON public.churches (status);

-- 2. Church Deletion (Archive) Function ---------------------------------------

CREATE OR REPLACE FUNCTION public.delete_church(p_church_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_impact jsonb;
    v_archived_admin_id uuid;
    v_person record;
BEGIN
    PERFORM public.assert_account_active();

    -- Raises for anyone but the Super Admin, and when the church does not exist
    v_impact := public.church_deletion_impact(p_church_id);

    -- Serialize with role changes in this church
    PERFORM pg_advisory_xact_lock(hashtext('set_user_role:' || p_church_id::text));

    -- Identify the church's primary Church Admin before demotions
    SELECT id INTO v_archived_admin_id
    FROM public.profiles
    WHERE role::text = 'church_admin'
      AND p_church_id IN (assigned_church_id, church_id)
      AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    -- Staff of this church stop being staff: clean up their channel membership first, then demote them.
    FOR v_person IN
        SELECT id FROM public.profiles
        WHERE role::text IN ('volunteer', 'priest', 'church_admin') AND p_church_id IN (assigned_church_id, church_id)
    LOOP
        PERFORM public.cleanup_staff_assignments(v_person.id, p_church_id);
    END LOOP;

    -- Role and church columns are guarded by triggers; allow role change here.
    PERFORM set_config('app.role_change_ok', '1', true);
    UPDATE public.profiles
    SET role = 'user',
        assigned_church_id = NULL,
        church_id = NULL,
        is_priest = false,
        updated_at = now()
    WHERE role::text IN ('volunteer', 'priest', 'church_admin') AND p_church_id IN (assigned_church_id, church_id);

    -- Everyone else linked to the church (parishioners with a home parish, Super Admin) loses the church link.
    UPDATE public.profiles
    SET assigned_church_id = CASE WHEN assigned_church_id = p_church_id THEN NULL ELSE assigned_church_id END,
        church_id = CASE WHEN church_id = p_church_id THEN NULL ELSE church_id END,
        updated_at = now()
    WHERE p_church_id IN (assigned_church_id, church_id);
    PERFORM set_config('app.role_change_ok', '', true);

    -- All appointments, donations, mass_schedules, announcements, church_images and conversations
    -- remain safely preserved intact. We move the church into archived state instead of deleting it.
    UPDATE public.churches
    SET status = 'archived',
        is_active = false,
        archived_at = now(),
        archived_admin_id = v_archived_admin_id,
        updated_at = now()
    WHERE id = p_church_id;

    INSERT INTO public.activity_logs (user_id, church_id, action, entity_type, entity_id, metadata)
    VALUES (v_uid, p_church_id, 'archive_church', 'churches', p_church_id, v_impact);

    RETURN v_impact;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_church(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_church(uuid) TO authenticated;

-- 3. Church Restore Status & Restore Functions -------------------------------

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
               AND v_admin.current_church_id IS NULL
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
           OR COALESCE(v_admin_profile.assigned_church_id, v_admin_profile.church_id) IS NOT NULL THEN
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
        IF v_admin_profile.role::text <> 'user' OR COALESCE(v_admin_profile.assigned_church_id, v_admin_profile.church_id) IS NOT NULL THEN
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

-- 4. User 7-Day Archiving Schema ---------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_archived_at ON public.profiles (archived_at) WHERE archived_at IS NOT NULL;

-- Blocked = deleted, suspended, or archived
CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((SELECT p.deleted_at IS NOT NULL OR p.suspended_at IS NOT NULL OR p.archived_at IS NOT NULL FROM public.profiles p WHERE p.id = _user_id), false);
$$;

REVOKE ALL ON FUNCTION public.is_user_blocked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_user_blocked(uuid) TO authenticated;

-- Guard profile role and archive columns
CREATE OR REPLACE FUNCTION public.guard_profile_role_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;
    IF COALESCE(current_setting('app.archive_ok', true), '') <> '1'
       AND COALESCE(current_setting('app.role_change_ok', true), '') <> '1'
       AND (NEW.archived_at IS DISTINCT FROM OLD.archived_at) THEN
        RAISE EXCEPTION 'Archiving can only be changed through delete_user_account and restore_user_account' USING ERRCODE = '42501';
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

-- Anonymize engine (clears archived_at when deleting permanently)
CREATE OR REPLACE FUNCTION public.anonymize_user(p_user_id uuid, p_requested_by uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_church uuid;
    v_requested_by uuid := COALESCE(p_requested_by, auth.uid());
    v_ticket record;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_profile.deleted_at IS NOT NULL THEN
        RETURN;
    END IF;
    IF v_profile.role::text = 'super_admin' THEN
        RAISE EXCEPTION 'The Super Admin account cannot be deleted' USING ERRCODE = '42501';
    END IF;

    v_church := COALESCE(v_profile.assigned_church_id, v_profile.church_id);

    IF v_church IS NOT NULL THEN
        PERFORM public.cleanup_staff_assignments(p_user_id, v_church);
    END IF;
    DELETE FROM public.conversation_participants cp
    USING public.conversations c
    WHERE cp.conversation_id = c.id AND cp.user_id = p_user_id AND c.type = 'channel';

    DELETE FROM public.notifications WHERE user_id = p_user_id;
    DELETE FROM public.priest_availability WHERE priest_id = p_user_id;

    UPDATE public.appointments
    SET status = 'cancelled', cancellation_reason = 'Account deleted', updated_at = NOW()
    WHERE user_id = p_user_id AND status = 'pending';

    FOR v_ticket IN
        SELECT id FROM public.conversations
        WHERE ticket_number IS NOT NULL AND created_by = p_user_id AND status IS DISTINCT FROM 'closed'
    LOOP
        UPDATE public.conversations SET status = 'closed', updated_at = NOW() WHERE id = v_ticket.id;
        INSERT INTO public.messages (conversation_id, sender_id, content, message_type, metadata)
        VALUES (v_ticket.id, p_user_id, 'The requester''s account was deleted', 'system',
                jsonb_build_object('event', 'ticket_closed_account_deleted'));
    END LOOP;

    PERFORM set_config('app.role_change_ok', '1', true);
    PERFORM set_config('app.archive_ok', '1', true);
    UPDATE public.profiles
    SET full_name = 'Deleted User',
        email = NULL,
        phone_number = NULL,
        avatar_url = NULL,
        fcm_token = NULL,
        is_verified = false,
        role = 'user',
        is_priest = false,
        assigned_church_id = NULL,
        church_id = NULL,
        archived_at = NULL,
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_user_id;
    PERFORM set_config('app.archive_ok', '', true);
    PERFORM set_config('app.role_change_ok', '', true);

    UPDATE auth.users
    SET email = 'deleted+' || p_user_id::text || '@deleted.invalid',
        phone = NULL,
        encrypted_password = '',
        raw_user_meta_data = '{}'::jsonb,
        raw_app_meta_data = '{}'::jsonb,
        banned_until = NOW() + interval '100 years',
        updated_at = NOW()
    WHERE id = p_user_id;
    DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
    DELETE FROM auth.identities WHERE user_id = p_user_id;

    INSERT INTO public.activity_logs (user_id, church_id, action, entity_type, entity_id, metadata)
    VALUES (v_requested_by, v_church, 'user_deleted', 'profiles', p_user_id,
            jsonb_build_object('requested_by', v_requested_by, 'previous_role', v_profile.role));
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_user(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 5. Auto-Purge Expired Archived Users Function -------------------------------

CREATE OR REPLACE FUNCTION public.purge_expired_archived_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user record;
    v_count integer := 0;
BEGIN
    FOR v_user IN
        SELECT id FROM public.profiles
        WHERE archived_at IS NOT NULL
          AND deleted_at IS NULL
          AND archived_at <= (now() - interval '7 days')
        ORDER BY archived_at ASC
    LOOP
        BEGIN
            PERFORM public.anonymize_user(v_user.id, NULL);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to purge archived user %: %', v_user.id, SQLERRM;
        END;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_archived_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_expired_archived_users() TO authenticated;

-- 6. User Deletion (Move to 7-Day Archive) ------------------------------------

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_target public.profiles%ROWTYPE;
    v_church uuid;
    v_ticket record;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
    END IF;
    PERFORM public.assert_account_active();

    -- Purge any existing expired archived users first
    PERFORM public.purge_expired_archived_users();

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_caller_id AND role::text = 'super_admin') THEN
        RAISE EXCEPTION 'Only the Super Admin can delete a user' USING ERRCODE = '42501';
    END IF;
    IF p_user_id = v_caller_id THEN
        RAISE EXCEPTION 'You cannot delete your own account here' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    IF v_target.id IS NULL THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_target.role::text = 'super_admin' THEN
        RAISE EXCEPTION 'The Super Admin cannot be deleted' USING ERRCODE = '42501';
    END IF;
    IF v_target.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'User is already deleted' USING ERRCODE = '42501';
    END IF;
    IF v_target.archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'User is already archived' USING ERRCODE = '42501';
    END IF;

    v_church := COALESCE(v_target.assigned_church_id, v_target.church_id);

    -- Last Church Admin guard: cannot delete the only Church Admin of an active church
    IF v_target.role::text = 'church_admin' AND v_church IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.churches WHERE id = v_church AND status <> 'archived') THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.profiles o
                WHERE o.role::text = 'church_admin'
                  AND COALESCE(o.assigned_church_id, o.church_id) = v_church
                  AND o.id <> p_user_id
                  AND o.deleted_at IS NULL
                  AND o.archived_at IS NULL
            ) THEN
                RAISE EXCEPTION 'Cannot delete the only Church Admin of an active church' USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;

    -- Demote any staff role, remove from staff channels
    IF v_church IS NOT NULL THEN
        PERFORM public.cleanup_staff_assignments(p_user_id, v_church);
    END IF;
    DELETE FROM public.conversation_participants cp
    USING public.conversations c
    WHERE cp.conversation_id = c.id AND cp.user_id = p_user_id AND c.type = 'channel';

    DELETE FROM public.priest_availability WHERE priest_id = p_user_id;

    -- Cancel their own pending appointments
    UPDATE public.appointments
    SET status = 'cancelled', cancellation_reason = 'Account archived', updated_at = NOW()
    WHERE user_id = p_user_id AND status = 'pending';

    -- Close open tickets
    FOR v_ticket IN
        SELECT id FROM public.conversations
        WHERE ticket_number IS NOT NULL AND created_by = p_user_id AND status IS DISTINCT FROM 'closed'
    LOOP
        UPDATE public.conversations SET status = 'closed', updated_at = NOW() WHERE id = v_ticket.id;
        INSERT INTO public.messages (conversation_id, sender_id, content, message_type, metadata)
        VALUES (v_ticket.id, p_user_id, 'The requester''s account was moved to archive', 'system',
                jsonb_build_object('event', 'ticket_closed_account_archived'));
    END LOOP;

    -- Profile: keep full_name, email, phone_number, avatar_url intact; set archived_at
    PERFORM set_config('app.role_change_ok', '1', true);
    PERFORM set_config('app.archive_ok', '1', true);
    UPDATE public.profiles
    SET role = 'user',
        assigned_church_id = NULL,
        church_id = NULL,
        is_priest = false,
        archived_at = NOW(),
        updated_at = NOW()
    WHERE id = p_user_id;
    PERFORM set_config('app.archive_ok', '', true);
    PERFORM set_config('app.role_change_ok', '', true);

    -- Ban login sessions while archived
    UPDATE auth.users
    SET banned_until = NOW() + interval '100 years',
        updated_at = NOW()
    WHERE id = p_user_id;
    DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;
    DELETE FROM auth.sessions WHERE user_id = p_user_id;

    INSERT INTO public.activity_logs (user_id, church_id, action, entity_type, entity_id, metadata)
    VALUES (v_caller_id, v_church, 'user_archived', 'profiles', p_user_id,
            jsonb_build_object('requested_by', v_caller_id, 'previous_role', v_target.role));
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;

-- 7. User Restore Function ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.restore_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_target public.profiles%ROWTYPE;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
    END IF;
    PERFORM public.assert_account_active();

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_caller_id AND role::text = 'super_admin') THEN
        RAISE EXCEPTION 'Only the Super Admin can restore a user' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    IF v_target.id IS NULL THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_target.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'A permanently deleted user cannot be restored' USING ERRCODE = '42501';
    END IF;
    IF v_target.archived_at IS NULL THEN
        RAISE EXCEPTION 'This user is not archived' USING ERRCODE = '42501';
    END IF;

    PERFORM set_config('app.role_change_ok', '1', true);
    PERFORM set_config('app.archive_ok', '1', true);
    UPDATE public.profiles
    SET archived_at = NULL,
        role = 'user',
        updated_at = NOW()
    WHERE id = p_user_id;
    PERFORM set_config('app.archive_ok', '', true);
    PERFORM set_config('app.role_change_ok', '', true);

    -- Unban login
    UPDATE auth.users
    SET banned_until = NULL,
        updated_at = NOW()
    WHERE id = p_user_id;

    INSERT INTO public.activity_logs (user_id, church_id, action, entity_type, entity_id, metadata)
    VALUES (v_caller_id, COALESCE(v_target.assigned_church_id, v_target.church_id), 'user_restored', 'profiles', p_user_id,
            jsonb_build_object('restored_by', v_caller_id));
END;
$$;

REVOKE ALL ON FUNCTION public.restore_user_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_user_account(uuid) TO authenticated;
