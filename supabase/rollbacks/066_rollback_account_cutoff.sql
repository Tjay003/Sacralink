-- =========================================================
-- ROLLBACK for MIGRATION 066 (instant cut-off for blocked accounts). Not applied by scripts/local-db-setup.ps1.
-- =========================================================
-- Removes every restrictive policy 066 added, restores the helpers to their pre-066 bodies, and turns
-- is_account_blocked()/assert_account_active() into no-ops, so the PERFORM assert_account_active() calls that 066 left
-- inside the RPCs keep working but never block. The deleted_at column, anonymize_user and delete_user_account are
-- left in place (already-deleted accounts stay anonymized); drop them by hand if the feature itself must go.

DO $$
DECLARE
    t record;
BEGIN
    FOR t IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Blocked accounts have no access" ON %I.%I', t.schemaname, t.tablename);
    END LOOP;
    BEGIN
        DROP POLICY IF EXISTS "Blocked accounts have no access" ON storage.objects;
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE WARNING 'Could not drop the blocked-account policy on storage.objects. Drop it from the SQL editor.';
    END;
END;
$$;

DROP POLICY IF EXISTS "Blocked accounts read only their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Blocked accounts cannot insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Blocked accounts cannot update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Blocked accounts cannot delete profiles" ON public.profiles;
DROP TRIGGER IF EXISTS trg_guard_blocked_profile_writes ON public.profiles;
DROP POLICY IF EXISTS "No messages to a blocked user" ON public.messages;

CREATE OR REPLACE FUNCTION public.is_account_blocked()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT false; $$;

CREATE OR REPLACE FUNCTION public.assert_account_active()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN; END; $$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.get_current_user_church_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT COALESCE(assigned_church_id, church_id) FROM public.profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.can_access_conversation_by_id(_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT public.can_access_conversation(c.id, c.type, c.church_id, c.ticket_number)
     FROM public.conversations c WHERE c.id = _conversation_id),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_channel(_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = _conversation_id AND c.type = 'channel'
  );
$$;

-- can_access_conversation: the is_account_blocked() check is a no-op once the helper above returns false.
-- get_my_unread_message_count: the assert is a no-op too, so the 066 body can stay.
