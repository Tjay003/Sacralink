-- =========================================================
-- MIGRATION 067: Ticket permissions, ticket_set_status() and automatic status
-- =========================================================
-- "Who may read, reply and change status" on a ticket becomes a database rule:
--   1. is_ticket_handler(): the one predicate for "this person works the ticket",
--   2. the read rule for tickets is evaluated live (not through participant rows) and replaces the temporary
--      platform branch added by migration 064,
--   3. the write rule for messages on tickets (requester or handler, never on a closed ticket, no client system notes),
--   4. a column lock on ticket rows so status, assignment, lane and so on only change through our own functions,
--   5. ticket_set_status(), the only way a handler changes status,
--   6. automatic status: a handler's first reply starts the ticket, a requester's reply wakes a resolved one.
-- Requires migration 066 (is_account_blocked, assert_account_active). Additive and idempotent. No 'admin' role: ticket 02 retired it.

-- 1. Handler predicate -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_ticket_handler(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE
      -- The Super Admin handles platform tickets and escalated church tickets, never a non-escalated church ticket
      WHEN p.role::text = 'super_admin' THEN (c.ticket_lane = 'platform' OR c.escalated_at IS NOT NULL)
      -- The Church Admin of the ticket's church handles its non-escalated church tickets
      WHEN p.role::text = 'church_admin' THEN (
        c.ticket_lane = 'church'
        AND c.escalated_at IS NULL
        AND (p.church_id = c.church_id OR p.assigned_church_id = c.church_id)
      )
      -- The current assignee, while still a Priest or Volunteer of that church
      WHEN p.role::text IN ('priest', 'volunteer') THEN (
        c.ticket_lane = 'church'
        AND c.escalated_at IS NULL
        AND c.assigned_to = p.id
        AND (p.church_id = c.church_id OR p.assigned_church_id = c.church_id)
      )
      ELSE false
    END
    FROM public.conversations c
    JOIN public.profiles p ON p.id = _user_id
    WHERE c.id = _conversation_id
      AND c.ticket_number IS NOT NULL
  ), false);
$$;

REVOKE ALL ON FUNCTION public.is_ticket_handler(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_ticket_handler(uuid, uuid) TO authenticated;

-- 2. Read rule -------------------------------------------------------------------------------------
-- Non-ticket kinds keep the rules of migrations 059/064; the ticket branch is evaluated live from the row.
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
  _requester uuid;
BEGIN
  -- A blocked or deleted account (migration 066) reads nothing
  IF _uid IS NULL OR public.is_account_blocked() THEN
    RETURN false;
  END IF;

  IF _type = 'group' AND _ticket_number IS NOT NULL THEN
    -- Ticket: only the requester or a handler. Participant rows never grant read access to a ticket.
    -- A platform ticket is readable by its requester and the Super Admin only. To also let the requester's
    -- own Church Admin read it, add "OR (lane = platform AND church_admin of the ticket's church)" here.
    SELECT c.created_by INTO _requester FROM public.conversations c WHERE c.id = _conversation_id;
    RETURN COALESCE(_requester = _uid OR public.is_ticket_handler(_conversation_id, _uid), false);
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
      _role = 'super_admin'
      OR (_role IN ('church_admin', 'priest', 'volunteer') AND (_participant OR _church_match)),
      false
    );
  ELSIF _type = 'group' THEN
    -- Ministry group
    RETURN COALESCE(
      _participant
      OR _role = 'super_admin'
      OR (_role IN ('church_admin', 'priest', 'volunteer') AND _church_match),
      false
    );
  END IF;

  RETURN _participant;
END;
$$;

-- 3. Write rule for messages -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_send_message(_conversation_id uuid, _message_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_ticket boolean;
  _status text;
  _requester uuid;
BEGIN
  IF _uid IS NULL OR public.is_account_blocked() THEN
    RETURN false;
  END IF;

  SELECT (c.ticket_number IS NOT NULL), c.status, c.created_by
    INTO _is_ticket, _status, _requester
  FROM public.conversations c
  WHERE c.id = _conversation_id;

  IF _is_ticket IS NULL THEN
    RETURN false;
  END IF;
  IF NOT _is_ticket THEN
    RETURN public.can_access_conversation_by_id(_conversation_id);
  END IF;

  RETURN COALESCE(
    _message_type IS DISTINCT FROM 'system'
    AND _status IS DISTINCT FROM 'closed'
    AND (_requester = _uid OR public.is_ticket_handler(_conversation_id, _uid)),
    false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_send_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_send_message(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Users can send messages in permitted conversations" ON public.messages;
CREATE POLICY "Users can send messages in permitted conversations"
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND public.can_send_message(conversation_id, message_type)
);

-- 4. Column lock on ticket rows --------------------------------------------------------------------
-- Only code that does not run as a signed-in client may change these columns: our SECURITY DEFINER functions
-- (current_user is their owner), the service role and the SQL editor.
CREATE OR REPLACE FUNCTION public.lock_ticket_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.ticket_number IS NOT NULL AND current_user IN ('authenticated', 'anon') AND (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
    OR NEW.escalated_at IS DISTINCT FROM OLD.escalated_at
    OR NEW.sent_back_at IS DISTINCT FROM OLD.sent_back_at
    OR NEW.reopen_count IS DISTINCT FROM OLD.reopen_count
    OR NEW.ticket_lane IS DISTINCT FROM OLD.ticket_lane
    OR NEW.church_id IS DISTINCT FROM OLD.church_id
    OR NEW.ticket_number IS DISTINCT FROM OLD.ticket_number
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.linked_ticket_id IS DISTINCT FROM OLD.linked_ticket_id
  ) THEN
    RAISE EXCEPTION 'Ticket status, assignment and routing can only be changed through the ticket functions.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_ticket_columns ON public.conversations;
CREATE TRIGGER trg_lock_ticket_columns
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.lock_ticket_columns();

-- The old policy let the requester and every staff member of the church rewrite any column of a ticket
DROP POLICY IF EXISTS "Staff can update ticket status" ON public.conversations;

-- What is left of UPDATE on a ticket is touching it, and only for people who can read it
DROP POLICY IF EXISTS "Ticket rows are updated only by people who can read them" ON public.conversations;
CREATE POLICY "Ticket rows are updated only by people who can read them"
ON public.conversations AS RESTRICTIVE FOR UPDATE
USING (ticket_number IS NULL OR public.can_access_conversation_by_id(id))
WITH CHECK (ticket_number IS NULL OR public.can_access_conversation_by_id(id));

-- 5. ticket_set_status -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_set_status(p_ticket_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old text;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to change a ticket.' USING ERRCODE = '28000';
  END IF;
  PERFORM public.assert_account_active();
  IF p_status IS NULL OR p_status NOT IN ('open', 'in_progress', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'Unknown ticket status.' USING ERRCODE = '22023';
  END IF;

  SELECT c.status INTO v_old
  FROM public.conversations c
  WHERE c.id = p_ticket_id AND c.ticket_number IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND OR NOT public.is_ticket_handler(p_ticket_id, v_uid) THEN
    RAISE EXCEPTION 'You cannot change the status of this ticket.' USING ERRCODE = '42501';
  END IF;
  IF v_old IS NOT DISTINCT FROM p_status THEN
    RAISE EXCEPTION 'The ticket is already %.', replace(p_status, '_', ' ') USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'A staff member') INTO v_name
  FROM public.profiles p WHERE p.id = v_uid;

  UPDATE public.conversations
  SET status = p_status, updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO public.messages (conversation_id, sender_id, content, message_type, metadata)
  VALUES (
    p_ticket_id,
    v_uid,
    v_name || ' changed the status from ' || replace(COALESCE(v_old, 'open'), '_', ' ') || ' to ' || replace(p_status, '_', ' ') || '.',
    'system',
    jsonb_build_object('event', 'ticket_status_changed', 'from', COALESCE(v_old, 'open'), 'to', p_status)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_set_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_set_status(uuid, text) TO authenticated;

-- 6. Automatic status ------------------------------------------------------------------------------
-- A handler's message moves open to in_progress; a requester's message on a resolved ticket moves it to open.
-- reopen_count is not touched: only an explicit Reopen of a closed ticket counts (ticket 15).
CREATE OR REPLACE FUNCTION public.ticket_auto_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_requester uuid;
  v_new text;
  v_name text;
BEGIN
  IF NEW.message_type = 'system' THEN
    RETURN NEW;
  END IF;

  SELECT c.status, c.created_by INTO v_status, v_requester
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id AND c.ticket_number IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_status = 'open' AND NEW.sender_id IS DISTINCT FROM v_requester
     AND public.is_ticket_handler(NEW.conversation_id, NEW.sender_id) THEN
    v_new := 'in_progress';
  ELSIF v_status = 'resolved' AND NEW.sender_id = v_requester THEN
    v_new := 'open';
  ELSE
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'A participant') INTO v_name
  FROM public.profiles p WHERE p.id = NEW.sender_id;

  UPDATE public.conversations SET status = v_new, updated_at = now() WHERE id = NEW.conversation_id;

  INSERT INTO public.messages (conversation_id, sender_id, content, message_type, metadata)
  VALUES (
    NEW.conversation_id,
    NEW.sender_id,
    v_name || ' changed the status from ' || replace(v_status, '_', ' ') || ' to ' || replace(v_new, '_', ' ') || '.',
    'system',
    jsonb_build_object('event', 'ticket_status_changed', 'from', v_status, 'to', v_new, 'automatic', true)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_auto_status ON public.messages;
CREATE TRIGGER trg_ticket_auto_status
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.ticket_auto_status();

NOTIFY pgrst, 'reload schema';
