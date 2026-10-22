-- ============================================================================
-- Migration 065: Direct-message matrix, creation function and legacy chats
-- ============================================================================
-- Spec decisions 27 and 33 (ticket 10b). Who may START a new Direct chat is decided in the
-- database, not the browser:
--
--   Initiator     can start a chat with
--   Parishioner   nobody (raise a ticket)
--   Volunteer     nobody (raise a ticket, or use the church staff channel)
--   Priest        a parishioner who has an appointment with them; a Church Admin of their own church
--   Church Admin  the Super Admin; any Church Admin; parishioners, Priests and Volunteers of their own church
--   Super Admin   Church Admins only
--
-- "Own church" is COALESCE(assigned_church_id, church_id) on both profiles. A Priest is a profile with
-- role = 'priest' or is_priest = true (unless the profile is a Church Admin or the Super Admin).
--
--   1. _direct_role / _direct_church / _direct_matrix_allows: internal pure matrix helpers.
--   2. may_start_direct(initiator, target): matrix plus the account-state check (blocked or deleted
--      accounts are neither initiators nor targets; uses is_user_blocked once ticket 07 ships).
--   3. start_direct_conversation(target): the only way to create a Direct chat.
--   4. RESTRICTIVE policies so REST can no longer insert a direct conversation or add a participant
--      to one; the legacy volunteer_may_add_participant policy (061) is dropped.
--   5. direct_is_legacy(conversation) and is_legacy_direct(conversations row): a Direct chat whose
--      starter could not start it today. A RESTRICTIVE messages INSERT policy makes such chats
--      read-only for Parishioners and Volunteers ("Please open a ticket"). Rows are never touched.
--
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

-- 1. Internal helpers --------------------------------------------------------

-- One of: super_admin, church_admin, priest, volunteer, user (NULL when the profile does not exist).
CREATE OR REPLACE FUNCTION public._direct_role(_uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.role::text = 'super_admin' THEN 'super_admin'
    WHEN p.role::text = 'church_admin' THEN 'church_admin'
    WHEN p.role::text = 'priest' OR COALESCE(p.is_priest, false) THEN 'priest'
    WHEN p.role::text = 'volunteer' THEN 'volunteer'
    ELSE 'user'
  END
  FROM public.profiles p
  WHERE p.id = _uid;
$$;

CREATE OR REPLACE FUNCTION public._direct_church(_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p.assigned_church_id, p.church_id) FROM public.profiles p WHERE p.id = _uid;
$$;

-- The pure matrix: no account-state check, so legacy detection keeps working for blocked starters.
CREATE OR REPLACE FUNCTION public._direct_matrix_allows(_initiator uuid, _target uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ir text := public._direct_role(_initiator);
  _tr text := public._direct_role(_target);
  _ic uuid := public._direct_church(_initiator);
  _tc uuid := public._direct_church(_target);
BEGIN
  IF _ir IS NULL OR _tr IS NULL OR _initiator = _target THEN
    RETURN false;
  END IF;

  IF _ir = 'priest' THEN
    IF _tr = 'user' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.priest_id = _initiator AND a.user_id = _target
      );
    END IF;
    RETURN COALESCE(_tr = 'church_admin' AND _ic = _tc, false);
  ELSIF _ir = 'church_admin' THEN
    IF _tr IN ('super_admin', 'church_admin') THEN
      RETURN true;
    END IF;
    RETURN COALESCE(_tr IN ('user', 'priest', 'volunteer') AND _ic = _tc, false);
  ELSIF _ir = 'super_admin' THEN
    RETURN _tr = 'church_admin';
  END IF;

  -- Parishioners and Volunteers never start a Direct chat
  RETURN false;
END;
$$;

-- Active means the profile exists and, once ticket 07 has shipped, is not blocked or deleted.
CREATE OR REPLACE FUNCTION public._direct_account_active(_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _blocked boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid) THEN
    RETURN false;
  END IF;
  IF to_regprocedure('public.is_user_blocked(uuid)') IS NOT NULL THEN
    EXECUTE 'SELECT public.is_user_blocked($1)' INTO _blocked USING _uid;
  END IF;
  RETURN NOT COALESCE(_blocked, false);
END;
$$;

REVOKE ALL ON FUNCTION public._direct_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._direct_church(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._direct_matrix_allows(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._direct_account_active(uuid) FROM PUBLIC, anon, authenticated;

-- 2. may_start_direct --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.may_start_direct(_initiator uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public._direct_account_active(_initiator)
     AND public._direct_account_active(_target)
     AND public._direct_matrix_allows(_initiator, _target);
$$;

REVOKE ALL ON FUNCTION public.may_start_direct(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.may_start_direct(uuid, uuid) TO authenticated;

-- 3. start_direct_conversation ----------------------------------------------

CREATE OR REPLACE FUNCTION public.start_direct_conversation(p_target uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ir text;
  _tr text;
  _existing uuid;
  _new uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to start a conversation.' USING ERRCODE = '28000';
  END IF;

  -- Blocked or deleted accounts cannot start anything (ticket 07 provides the check)
  IF to_regprocedure('public.assert_account_active()') IS NOT NULL THEN
    EXECUTE 'SELECT public.assert_account_active()';
  END IF;

  IF p_target IS NULL OR p_target = _uid THEN
    RAISE EXCEPTION 'Choose another person to message.' USING ERRCODE = '22023';
  END IF;

  _ir := public._direct_role(_uid);
  _tr := public._direct_role(p_target);
  IF _ir IS NULL OR _tr IS NULL OR NOT public._direct_account_active(p_target) THEN
    RAISE EXCEPTION 'That person is not available for messages.' USING ERRCODE = '22023';
  END IF;

  -- Two people never get two Direct chats: serialize on the pair, then reuse the existing one
  PERFORM pg_advisory_xact_lock(hashtextextended(least(_uid, p_target)::text || greatest(_uid, p_target)::text, 0));

  SELECT c.id INTO _existing
  FROM public.conversations c
  WHERE c.type = 'direct'
    AND EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = _uid)
    AND EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = p_target)
  ORDER BY c.created_at
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  IF NOT public._direct_matrix_allows(_uid, p_target) THEN
    IF _ir = 'user' THEN
      RAISE EXCEPTION 'You cannot start a direct message. Raise a ticket instead.' USING ERRCODE = '42501';
    ELSIF _ir = 'volunteer' THEN
      RAISE EXCEPTION 'Volunteers cannot start direct messages. Use the church staff channel, or raise a ticket instead.' USING ERRCODE = '42501';
    ELSIF _ir = 'priest' THEN
      IF _tr = 'super_admin' THEN
        RAISE EXCEPTION 'Raise a platform ticket to reach the Super Admin.' USING ERRCODE = '42501';
      ELSIF _tr IN ('priest', 'volunteer') THEN
        RAISE EXCEPTION 'Use the church staff channel to reach other Priests and Volunteers.' USING ERRCODE = '42501';
      ELSIF _tr = 'user' THEN
        RAISE EXCEPTION 'Priests can only message parishioners who have an appointment with them. Raise a ticket instead.' USING ERRCODE = '42501';
      ELSE
        RAISE EXCEPTION 'Priests can only message the Church Admin of their own church.' USING ERRCODE = '42501';
      END IF;
    ELSIF _ir = 'church_admin' THEN
      RAISE EXCEPTION 'Church Admins can only message people of their own church. Ask that church''s Church Admin instead.' USING ERRCODE = '42501';
    ELSE
      RAISE EXCEPTION 'The Super Admin can only start direct messages with Church Admins. Raise a ticket instead.' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.conversations (type, created_by, title)
  VALUES ('direct', _uid, NULL)
  RETURNING id INTO _new;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (_new, _uid), (_new, p_target);

  RETURN _new;
END;
$$;

REVOKE ALL ON FUNCTION public.start_direct_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_direct_conversation(uuid) TO authenticated;

-- 4. Close the REST routes ---------------------------------------------------

DROP POLICY IF EXISTS "Volunteers only message their own parish staff" ON public.conversation_participants;
DROP FUNCTION IF EXISTS public.volunteer_may_add_participant(uuid, uuid);

-- SECURITY DEFINER code (start_direct_conversation, owned by the migration role) bypasses RLS, so
-- these restrictive policies only block REST callers.
DROP POLICY IF EXISTS "Direct conversations only through start_direct_conversation" ON public.conversations;
CREATE POLICY "Direct conversations only through start_direct_conversation"
ON public.conversations AS RESTRICTIVE FOR INSERT
WITH CHECK (type <> 'direct');

CREATE OR REPLACE FUNCTION public.conversation_is_direct(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = _conversation_id AND c.type = 'direct');
$$;

REVOKE ALL ON FUNCTION public.conversation_is_direct(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conversation_is_direct(uuid) TO authenticated;

DROP POLICY IF EXISTS "Direct participants only through start_direct_conversation" ON public.conversation_participants;
CREATE POLICY "Direct participants only through start_direct_conversation"
ON public.conversation_participants AS RESTRICTIVE FOR INSERT
WITH CHECK (NOT public.conversation_is_direct(conversation_id));

-- 5. Legacy Direct chats -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.direct_is_legacy(_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _type text;
  _creator uuid;
  _a uuid;
  _b uuid;
  _members uuid[];
BEGIN
  SELECT c.type, c.created_by INTO _type, _creator FROM public.conversations c WHERE c.id = _conversation_id;
  IF _type IS DISTINCT FROM 'direct' THEN
    RETURN false;
  END IF;

  SELECT array_agg(cp.user_id ORDER BY cp.user_id) INTO _members
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = _conversation_id;

  IF _members IS NULL OR array_length(_members, 1) < 2 THEN
    RETURN false;
  END IF;

  IF _creator IS NOT NULL AND _creator = ANY (_members) THEN
    -- Legacy when the starter could not start a chat with any other member today
    RETURN NOT EXISTS (
      SELECT 1 FROM unnest(_members) AS m
      WHERE m <> _creator AND public._direct_matrix_allows(_creator, m)
    );
  END IF;

  -- Starter unknown: legacy only when neither side could start it
  _a := _members[1];
  _b := _members[2];
  RETURN NOT public._direct_matrix_allows(_a, _b) AND NOT public._direct_matrix_allows(_b, _a);
END;
$$;

REVOKE ALL ON FUNCTION public.direct_is_legacy(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direct_is_legacy(uuid) TO authenticated;

-- Computed column for PostgREST: supabase.from('conversations').select('*, is_legacy_direct')
CREATE OR REPLACE FUNCTION public.is_legacy_direct(c public.conversations)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.direct_is_legacy(c.id);
$$;

REVOKE ALL ON FUNCTION public.is_legacy_direct(public.conversations) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_legacy_direct(public.conversations) TO authenticated;

-- Raises the readable error "Please open a ticket" (a bare policy failure would only say
-- "new row violates row-level security policy"). Returns true when the message may be posted.
CREATE OR REPLACE FUNCTION public.assert_direct_reply_allowed(_conversation_id uuid, _sender uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public._direct_role(_sender) IN ('user', 'volunteer') AND public.direct_is_legacy(_conversation_id) THEN
    RAISE EXCEPTION 'Please open a ticket' USING ERRCODE = '42501';
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_direct_reply_allowed(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_direct_reply_allowed(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Legacy direct chats read-only for parishioners, volunteers" ON public.messages;
CREATE POLICY "Legacy direct chats read-only for parishioners, volunteers"
ON public.messages AS RESTRICTIVE FOR INSERT
WITH CHECK (public.assert_direct_reply_allowed(conversation_id, sender_id));
