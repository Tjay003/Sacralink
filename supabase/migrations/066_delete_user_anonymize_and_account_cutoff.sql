-- =========================================================
-- MIGRATION 066: Super Admin deletes a user (anonymize in place) + instant cut-off for blocked accounts
-- =========================================================
-- "Delete" keeps the profiles and auth.users rows (FKs cascade from them) and anonymizes them, so appointments,
-- donations and messages survive. A blocked account (profiles.deleted_at set; ticket 19 adds suspended_at through
-- is_user_blocked) is cut off on its very next request: the RLS helpers return NULL/false, every table gets a
-- RESTRICTIVE policy, and definer functions call assert_account_active().
-- Rollback: supabase/rollbacks/066_rollback_account_cutoff.sql
-- Idempotent: safe to run more than once.

-- 1. Column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles (deleted_at) WHERE deleted_at IS NOT NULL;

-- 2. Blocked-account helpers. Ticket 19 redefines is_user_blocked to also cover suspended_at.
CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((SELECT p.deleted_at IS NOT NULL FROM public.profiles p WHERE p.id = _user_id), false);
$$;

CREATE OR REPLACE FUNCTION public.is_account_blocked()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN auth.uid() IS NULL THEN false ELSE public.is_user_blocked(auth.uid()) END;
$$;

CREATE OR REPLACE FUNCTION public.assert_account_active()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.is_account_blocked() THEN
        RAISE EXCEPTION 'This account is blocked' USING ERRCODE = '42501';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.is_user_blocked(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_account_blocked() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assert_account_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_user_blocked(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_blocked() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_account_active() TO authenticated;

-- 3. Cut-off inside the RLS helpers (about 100 policies call them).
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN public.is_user_blocked(p.id) THEN NULL ELSE p.role::text END
    FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_church_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE WHEN public.is_user_blocked(p.id) THEN NULL ELSE COALESCE(p.assigned_church_id, p.church_id) END
    FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_access_conversation(_conversation_id uuid, _type text, _church_id uuid, _ticket_number text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _role text;
  _church_match boolean;
  _participant boolean;
  _lane text;
BEGIN
  IF _uid IS NULL OR public.is_account_blocked() THEN
    RETURN false;
  END IF;

  SELECT p.role::text,
         COALESCE(p.church_id = _church_id OR p.assigned_church_id = _church_id, false)
    INTO _role, _church_match
  FROM public.profiles p
  WHERE p.id = _uid;

  _participant := EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = _conversation_id AND cp.user_id = _uid
  );

  IF _type = 'channel' THEN
    RETURN COALESCE(
      _role IN ('super_admin', 'admin')
      OR (_role IN ('church_admin', 'priest', 'volunteer') AND (_participant OR _church_match)),
      false
    );
  ELSIF _type = 'group' AND _ticket_number IS NOT NULL THEN
    SELECT c.ticket_lane INTO _lane FROM public.conversations c WHERE c.id = _conversation_id;
    IF _lane = 'platform' THEN
      RETURN COALESCE(_participant OR _role = 'super_admin', false);
    END IF;
    RETURN COALESCE(
      _participant
      OR _role IN ('super_admin', 'admin')
      OR (_role IN ('church_admin', 'volunteer') AND _church_match),
      false
    );
  ELSIF _type = 'group' THEN
    RETURN COALESCE(
      _participant
      OR _role IN ('super_admin', 'admin')
      OR (_role IN ('church_admin', 'priest', 'volunteer') AND _church_match),
      false
    );
  END IF;

  RETURN _participant;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_conversation_by_id(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT public.is_account_blocked() AND COALESCE(
    (SELECT public.can_access_conversation(c.id, c.type, c.church_id, c.ticket_number)
     FROM public.conversations c
     WHERE c.id = _conversation_id),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT public.is_account_blocked() AND EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_channel(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT public.is_account_blocked() AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND c.type = 'channel'
  );
$$;

-- 4. No messages to a blocked user (spec decision 38).
CREATE OR REPLACE FUNCTION public.direct_other_participant_blocked(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.conversations c
        JOIN public.conversation_participants cp ON cp.conversation_id = c.id
        WHERE c.id = _conversation_id
          AND c.type = 'direct'
          AND cp.user_id IS DISTINCT FROM auth.uid()
          AND public.is_user_blocked(cp.user_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.assert_direct_recipient_available(_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.direct_other_participant_blocked(_conversation_id) THEN
        RAISE EXCEPTION 'This user is no longer available' USING ERRCODE = '42501';
    END IF;
    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.direct_other_participant_blocked(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assert_direct_recipient_available(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direct_other_participant_blocked(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_direct_recipient_available(uuid) TO authenticated;

DROP POLICY IF EXISTS "No messages to a blocked user" ON public.messages;
CREATE POLICY "No messages to a blocked user"
ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.assert_direct_recipient_available(conversation_id));

-- 5. One RESTRICTIVE policy on every user-facing table (and storage.objects).
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT schemaname, tablename FROM pg_tables
        WHERE schemaname = 'public' AND rowsecurity
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Blocked accounts have no access" ON %I.%I', t.schemaname, t.tablename);
        EXECUTE format(
            'CREATE POLICY "Blocked accounts have no access" ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated '
            'USING ((SELECT NOT public.is_account_blocked())) WITH CHECK ((SELECT NOT public.is_account_blocked()))',
            t.schemaname, t.tablename);
    END LOOP;

    BEGIN
        DROP POLICY IF EXISTS "Blocked accounts have no access" ON storage.objects;
        CREATE POLICY "Blocked accounts have no access" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
            USING ((SELECT NOT public.is_account_blocked())) WITH CHECK ((SELECT NOT public.is_account_blocked()));
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE WARNING 'Could not add the blocked-account policy on storage.objects (not the owner). Add it from the SQL editor.';
    END;
END;
$$;

-- profiles: the caller's own row stays readable (the app reads deleted_at to sign out); every write is blocked.
-- profiles has row level security switched off in this project (migration 005), so these policies only take effect
-- if it is ever switched on; the trigger below enforces the write block regardless.
DROP POLICY IF EXISTS "Blocked accounts read only their own profile" ON public.profiles;
CREATE POLICY "Blocked accounts read only their own profile"
ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
USING (id = auth.uid() OR (SELECT NOT public.is_account_blocked()));

DROP POLICY IF EXISTS "Blocked accounts cannot insert profiles" ON public.profiles;
CREATE POLICY "Blocked accounts cannot insert profiles"
ON public.profiles AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK ((SELECT NOT public.is_account_blocked()));

DROP POLICY IF EXISTS "Blocked accounts cannot update profiles" ON public.profiles;
CREATE POLICY "Blocked accounts cannot update profiles"
ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
USING ((SELECT NOT public.is_account_blocked())) WITH CHECK ((SELECT NOT public.is_account_blocked()));

DROP POLICY IF EXISTS "Blocked accounts cannot delete profiles" ON public.profiles;
CREATE POLICY "Blocked accounts cannot delete profiles"
ON public.profiles AS RESTRICTIVE FOR DELETE TO authenticated
USING ((SELECT NOT public.is_account_blocked()));

CREATE OR REPLACE FUNCTION public.guard_blocked_profile_writes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND public.is_account_blocked() THEN
        RAISE EXCEPTION 'This account is blocked' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_blocked_profile_writes ON public.profiles;
CREATE TRIGGER trg_guard_blocked_profile_writes
    BEFORE INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.guard_blocked_profile_writes();

-- 6. get_my_unread_message_count now asserts too (same result for active accounts).
CREATE OR REPLACE FUNCTION public.get_my_unread_message_count()
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.assert_account_active();
  RETURN (
    SELECT COUNT(*)::integer
    FROM public.messages m
    JOIN public.conversation_participants cp
      ON cp.conversation_id = m.conversation_id
     AND cp.user_id = auth.uid()
    WHERE m.sender_id <> auth.uid()
      AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
  );
END;
$$;

-- 7. assert_account_active() at the top of every SECURITY DEFINER RPC that relies on auth.uid().
--    Inserts the call after the first top-level BEGIN of each plpgsql body; skips functions already patched.
--    Later migrations that redefine these functions must keep the call.
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
        JOIN pg_language l ON l.oid = p.prolang
        WHERE n.nspname = 'public'
          AND p.prosecdef
          AND l.lanname = 'plpgsql'
          AND p.prorettype <> 'trigger'::regtype
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND p.proname IN (
              'approve_appointment', 'reject_appointment', 'cancel_appointment', 'change_appointment_celebrant',
              'reschedule_appointment', 'restore_appointment', 'mark_appointment_celebrated',
              'light_church_candle', 'set_user_role', 'transfer_super_admin', 'start_direct_conversation',
              'create_ticket', 'update_church_livestream', 'delete_church_service_type',
              'seed_church_service_types', 'check_parish_slot', 'evaluate_parish_celebrants',
              'get_parish_clergy', 'refresh_church_stats', 'church_has_admin'
          )
    LOOP
        v_def := pg_get_functiondef(f.oid);
        IF position('assert_account_active' IN v_def) > 0 THEN
            CONTINUE;
        END IF;
        v_new := regexp_replace(v_def, E'\nBEGIN[ \t]*\r?\n',E'\nBEGIN\n  PERFORM public.assert_account_active();\n');
        IF v_new = v_def THEN
            RAISE EXCEPTION 'Could not patch %: no top-level BEGIN found', f.proname;
        END IF;
        EXECUTE v_new;
    END LOOP;
END;
$$;

-- 8. The anonymize engine. Internal: not granted to authenticated.
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

    -- Staff cleanup first (staff channel; ticket 13 later unassigns their church tickets), while the church is still set.
    IF v_church IS NOT NULL THEN
        PERFORM public.cleanup_staff_assignments(p_user_id, v_church);
    END IF;
    -- Any other staff-channel membership goes too. Direct chats and ticket threads stay so history remains readable.
    DELETE FROM public.conversation_participants cp
    USING public.conversations c
    WHERE cp.conversation_id = c.id AND cp.user_id = p_user_id AND c.type = 'channel';

    -- Personal data that should not outlive the person.
    DELETE FROM public.notifications WHERE user_id = p_user_id;
    DELETE FROM public.priest_availability WHERE priest_id = p_user_id;

    -- Their own pending requests can never be served. Approved ones stay as history.
    UPDATE public.appointments
    SET status = 'cancelled', cancellation_reason = 'Account deleted', updated_at = NOW()
    WHERE user_id = p_user_id AND status = 'pending';

    -- Close their open tickets with one system note each.
    FOR v_ticket IN
        SELECT id FROM public.conversations
        WHERE ticket_number IS NOT NULL AND created_by = p_user_id AND status IS DISTINCT FROM 'closed'
    LOOP
        UPDATE public.conversations SET status = 'closed', updated_at = NOW() WHERE id = v_ticket.id;
        INSERT INTO public.messages (conversation_id, sender_id, content, message_type, metadata)
        VALUES (v_ticket.id, p_user_id, 'The requester''s account was deleted', 'system',
                jsonb_build_object('event', 'ticket_closed_account_deleted'));
    END LOOP;

    -- The profile.
    PERFORM set_config('app.role_change_ok', '1', true);
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
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_user_id;
    PERFORM set_config('app.role_change_ok', '', true);

    -- The login: unusable email, no password, banned for good, signed out everywhere.
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

-- 9. The Super Admin entry point.
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_target_role text;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
    END IF;
    PERFORM public.assert_account_active();
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_caller_id AND role::text = 'super_admin') THEN
        RAISE EXCEPTION 'Only the Super Admin can delete a user' USING ERRCODE = '42501';
    END IF;
    IF p_user_id = v_caller_id THEN
        RAISE EXCEPTION 'You cannot delete your own account here' USING ERRCODE = '42501';
    END IF;
    SELECT role::text INTO v_target_role FROM public.profiles WHERE id = p_user_id;
    IF v_target_role IS NULL THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_target_role = 'super_admin' THEN
        RAISE EXCEPTION 'The Super Admin cannot be deleted' USING ERRCODE = '42501';
    END IF;
    PERFORM public.anonymize_user(p_user_id, v_caller_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;
