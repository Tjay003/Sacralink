-- ============================================================================
-- Migration 059: Strict Direct Message privacy, Staff Channel role filtering and
--                Parish Office Ticket visibility (see docs/adr/0002-messaging-and-ticket-privacy-rls.md)
-- ============================================================================
-- Conversation kinds in this schema:
--   * Direct Message      : conversations.type = 'direct'
--   * Parish Staff Channel: conversations.type = 'channel'
--   * Parish Office Ticket: conversations.type = 'group' AND ticket_number IS NOT NULL
--   * Ministry group      : conversations.type = 'group' AND ticket_number IS NULL
--
-- Visibility after this migration:
--   * Direct Messages are visible ONLY to their conversation_participants rows
--     (no super_admin / church_admin override).
--   * Staff Channels are visible to church_admin / priest / volunteer of that parish
--     (or participants holding one of those roles), plus super_admin / admin. Never to role 'user'.
--   * Tickets are visible to participants (requester, claiming staff), church_admin / volunteer
--     of that parish, plus super_admin / admin.
--   * Ministry groups are visible to participants and to staff of that parish, plus super_admin / admin.
--
-- Safe to re-run: every statement is idempotent. Existing data is only touched by step 1,
-- which removes Staff Channel participant rows that belong to role = 'user' profiles.
-- ============================================================================

-- 1. Clean up parishioners that were wrongly enrolled in Staff Channels
DELETE FROM public.conversation_participants cp
USING public.conversations c, public.profiles p
WHERE cp.conversation_id = c.id
  AND c.type = 'channel'
  AND p.id = cp.user_id
  AND p.role = 'user';

-- 2. SECURITY DEFINER helpers (fixed search_path, no RLS recursion on conversation_participants)

-- Core rule engine. Takes the conversation columns directly so it also works for a row that is
-- being inserted in the same statement (INSERT ... RETURNING), where a lookup by id cannot see it.
CREATE OR REPLACE FUNCTION public.can_access_conversation(
  _conversation_id uuid,
  _type text,
  _church_id uuid,
  _ticket_number text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _role text;
  _church_match boolean;
  _participant boolean;
BEGIN
  IF _uid IS NULL THEN
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
    -- Parish Staff Channel
    RETURN COALESCE(
      _role IN ('super_admin', 'admin')
      OR (_role IN ('church_admin', 'priest', 'volunteer') AND (_participant OR _church_match)),
      false
    );
  ELSIF _type = 'group' AND _ticket_number IS NOT NULL THEN
    -- Parish Office Ticket
    RETURN COALESCE(
      _participant
      OR _role IN ('super_admin', 'admin')
      OR (_role IN ('church_admin', 'volunteer') AND _church_match),
      false
    );
  ELSIF _type = 'group' THEN
    -- Ministry group
    RETURN COALESCE(
      _participant
      OR _role IN ('super_admin', 'admin')
      OR (_role IN ('church_admin', 'priest', 'volunteer') AND _church_match),
      false
    );
  END IF;

  -- Direct Message (and any other kind): strictly participants only
  RETURN _participant;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_conversation_by_id(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT public.can_access_conversation(c.id, c.type, c.church_id, c.ticket_number)
     FROM public.conversations c
     WHERE c.id = _conversation_id),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_channel(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND c.type = 'channel'
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_conversation(uuid, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_conversation_by_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff_channel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_conversation(uuid, text, uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_access_conversation_by_id(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_staff_channel(uuid) TO authenticated, anon;

-- 3. Replace every SELECT policy on conversations and messages (whatever it was named on this database)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND ((tablename IN ('conversations', 'messages') AND cmd = 'SELECT')
        OR (tablename = 'messages' AND cmd = 'INSERT'))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END
$$;

-- The creator shortcut lets INSERT ... RETURNING work before the participant rows exist
CREATE POLICY "Users can view permitted conversations"
ON public.conversations FOR SELECT
USING (
  created_by = auth.uid()
  OR public.can_access_conversation(id, type, church_id, ticket_number)
);

CREATE POLICY "Users can view messages in permitted conversations"
ON public.messages FOR SELECT
USING (public.can_access_conversation_by_id(conversation_id));

CREATE POLICY "Users can send messages in permitted conversations"
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND public.can_access_conversation_by_id(conversation_id)
);

-- 4. Participant rows: no super_admin peek at who talks to whom in Direct Messages
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view participants of permitted conversations" ON public.conversation_participants;

CREATE POLICY "Users can view participants of permitted conversations"
ON public.conversation_participants FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_conversation_participant(conversation_id, auth.uid())
  OR public.can_access_conversation_by_id(conversation_id)
);

-- 5. Parishioners can never be enrolled in a Staff Channel, whoever tries to add them.
-- RESTRICTIVE policies are ANDed with the existing permissive INSERT policies.
DROP POLICY IF EXISTS "Parishioners cannot join staff channels" ON public.conversation_participants;

CREATE POLICY "Parishioners cannot join staff channels"
ON public.conversation_participants AS RESTRICTIVE FOR INSERT
WITH CHECK (
  NOT public.is_staff_channel(conversation_id)
  OR public.get_user_role(user_id) <> 'user'
);
