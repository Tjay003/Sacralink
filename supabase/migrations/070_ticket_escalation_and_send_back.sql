-- =========================================================
-- MIGRATION 070: Escalate a ticket to the Super Admin, request a review, send it back
-- =========================================================
--   1. _ticket_apply_escalation(): the one internal helper behind ticket_escalate and ticket_request_review,
--   2. ticket_escalate(): the Church Admin or the assignee hands a church ticket up,
--   3. ticket_request_review(): the requester escalates a church ticket nobody answered for 7 days,
--   4. list_escalated_ticket_stubs(): the only thing a Church Admin learns about an escalated ticket (number and date),
--   5. ticket_send_back(): the Super Admin returns a ticket to the church with a note.
-- Requires 064 (ticket columns), 066 (assert_account_active) and 067 (is_ticket_handler). Additive and idempotent.

-- 1. Shared escalation effects ----------------------------------------------------------------------
-- Not callable by clients: only the two public functions below reach it, so the effects cannot drift.
CREATE OR REPLACE FUNCTION public._ticket_apply_escalation(p_ticket_id uuid, p_actor uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester uuid;
  v_lost uuid[];
BEGIN
  SELECT c.created_by INTO v_requester FROM public.conversations c WHERE c.id = p_ticket_id;

  -- Everyone but the requester loses the ticket (the assignee, the Church Admins, any former assignee)
  SELECT COALESCE(array_agg(cp.user_id), ARRAY[]::uuid[]) INTO v_lost
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = p_ticket_id AND cp.user_id IS DISTINCT FROM v_requester;

  DELETE FROM public.conversation_participants
  WHERE conversation_id = p_ticket_id AND user_id IS DISTINCT FROM v_requester;

  DELETE FROM public.notifications n
  WHERE n.user_id = ANY (v_lost)
    AND COALESCE(n.is_read, false) = false
    AND n.link LIKE '%' || p_ticket_id::text || '%';

  UPDATE public.conversations
  SET escalated_at = now(),
      assigned_to = NULL,
      status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
      updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  SELECT p_ticket_id, p.id FROM public.profiles p WHERE p.role::text = 'super_admin'
  ON CONFLICT DO NOTHING;

  INSERT INTO public.messages (conversation_id, sender_id, content, message_type, metadata)
  VALUES (p_ticket_id, p_actor, p_note, 'system', jsonb_build_object('event', 'ticket_escalated'));
END;
$$;

REVOKE ALL ON FUNCTION public._ticket_apply_escalation(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- 2. ticket_escalate ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_escalate(p_ticket_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reason text := btrim(COALESCE(p_reason, ''));
  v_lane text;
  v_status text;
  v_escalated timestamptz;
  v_sent_back timestamptz;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to change a ticket.' USING ERRCODE = '28000';
  END IF;
  PERFORM public.assert_account_active();

  SELECT c.ticket_lane, c.status, c.escalated_at, c.sent_back_at
    INTO v_lane, v_status, v_escalated, v_sent_back
  FROM public.conversations c
  WHERE c.id = p_ticket_id AND c.ticket_number IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND OR NOT public.is_ticket_handler(p_ticket_id, v_uid) THEN
    RAISE EXCEPTION 'You cannot escalate this ticket.' USING ERRCODE = '42501';
  END IF;
  IF v_lane IS DISTINCT FROM 'church' THEN
    RAISE EXCEPTION 'Only a church ticket can be escalated.' USING ERRCODE = '22023';
  END IF;
  IF v_status = 'closed' THEN
    RAISE EXCEPTION 'A closed ticket cannot be escalated.' USING ERRCODE = '22023';
  END IF;
  IF v_escalated IS NOT NULL THEN
    RAISE EXCEPTION 'This ticket is already escalated.' USING ERRCODE = '22023';
  END IF;
  IF v_sent_back IS NOT NULL THEN
    RAISE EXCEPTION 'The Super Admin sent this ticket back, so it cannot be escalated again.' USING ERRCODE = '22023';
  END IF;
  IF length(v_reason) < 10 THEN
    RAISE EXCEPTION 'Give a reason of at least 10 characters.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role::text = 'super_admin') THEN
    RAISE EXCEPTION 'There is no Super Admin to receive this ticket.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'A staff member') INTO v_name
  FROM public.profiles p WHERE p.id = v_uid;

  PERFORM public._ticket_apply_escalation(
    p_ticket_id, v_uid, v_name || ' escalated this ticket to the Super Admin: ' || v_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_escalate(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_escalate(uuid, text) TO authenticated;

-- 3. ticket_request_review ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_request_review(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lane text;
  v_status text;
  v_requester uuid;
  v_created timestamptz;
  v_escalated timestamptz;
  v_sent_back timestamptz;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to change a ticket.' USING ERRCODE = '28000';
  END IF;
  PERFORM public.assert_account_active();

  SELECT c.ticket_lane, c.status, c.created_by, c.created_at, c.escalated_at, c.sent_back_at
    INTO v_lane, v_status, v_requester, v_created, v_escalated, v_sent_back
  FROM public.conversations c
  WHERE c.id = p_ticket_id AND c.ticket_number IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND OR v_requester IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'You cannot ask for a review of this ticket.' USING ERRCODE = '42501';
  END IF;
  IF v_lane IS DISTINCT FROM 'church' THEN
    RAISE EXCEPTION 'Only a church ticket can be sent for review.' USING ERRCODE = '22023';
  END IF;
  IF v_status = 'closed' THEN
    RAISE EXCEPTION 'A closed ticket cannot be sent for review.' USING ERRCODE = '22023';
  END IF;
  IF v_escalated IS NOT NULL THEN
    RAISE EXCEPTION 'This ticket is already with the Super Admin.' USING ERRCODE = '22023';
  END IF;
  IF v_sent_back IS NOT NULL THEN
    RAISE EXCEPTION 'The Super Admin sent this ticket back, so it cannot be escalated again.' USING ERRCODE = '22023';
  END IF;
  IF v_created > now() - interval '7 days' THEN
    RAISE EXCEPTION 'You can ask the Super Admin to review a ticket after 7 days without a reply.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.conversation_id = p_ticket_id
      AND m.message_type IS DISTINCT FROM 'system'
      AND m.sender_id IS DISTINCT FROM v_requester
  ) THEN
    RAISE EXCEPTION 'The church has already replied to this ticket.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role::text = 'super_admin') THEN
    RAISE EXCEPTION 'There is no Super Admin to receive this ticket.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'The requester') INTO v_name
  FROM public.profiles p WHERE p.id = v_uid;

  PERFORM public._ticket_apply_escalation(
    p_ticket_id, v_uid, v_name || ' asked the Super Admin to review this ticket (no reply for 7 days)'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_request_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_request_review(uuid) TO authenticated;

-- 4. list_escalated_ticket_stubs ---------------------------------------------------------------------
-- Content-free on purpose: number and date only. No policy, view or grant gives the Church Admin row access.
CREATE OR REPLACE FUNCTION public.list_escalated_ticket_stubs()
RETURNS TABLE(ticket_number text, escalated_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_account_active();
  RETURN QUERY
  SELECT c.ticket_number, c.escalated_at
  FROM public.conversations c
  JOIN public.profiles p ON p.id = auth.uid()
  WHERE p.role::text = 'church_admin'
    AND c.ticket_number IS NOT NULL
    AND c.ticket_lane = 'church'
    AND c.escalated_at IS NOT NULL
    AND (p.church_id = c.church_id OR p.assigned_church_id = c.church_id)
  ORDER BY c.escalated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_escalated_ticket_stubs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_escalated_ticket_stubs() TO authenticated;

-- 5. ticket_send_back --------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_send_back(p_ticket_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_note text := btrim(COALESCE(p_note, ''));
  v_lane text;
  v_status text;
  v_category text;
  v_church uuid;
  v_requester uuid;
  v_escalated timestamptz;
  v_requester_role text;
  v_name text;
  v_super_admins uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to change a ticket.' USING ERRCODE = '28000';
  END IF;
  PERFORM public.assert_account_active();

  SELECT c.ticket_lane, c.status, c.category, c.church_id, c.created_by, c.escalated_at
    INTO v_lane, v_status, v_category, v_church, v_requester, v_escalated
  FROM public.conversations c
  WHERE c.id = p_ticket_id AND c.ticket_number IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND role::text = 'super_admin')
     OR NOT public.is_ticket_handler(p_ticket_id, v_uid) THEN
    RAISE EXCEPTION 'You cannot send this ticket back.' USING ERRCODE = '42501';
  END IF;
  IF v_status = 'closed' THEN
    RAISE EXCEPTION 'A closed ticket cannot be sent back.' USING ERRCODE = '22023';
  END IF;
  IF length(v_note) < 10 THEN
    RAISE EXCEPTION 'Give a note of at least 10 characters.' USING ERRCODE = '22023';
  END IF;

  SELECT p.role::text INTO v_requester_role FROM public.profiles p WHERE p.id = v_requester;

  IF v_lane = 'church' AND v_escalated IS NOT NULL THEN
    NULL; -- (a) an escalated church ticket
  ELSIF v_lane = 'platform'
        AND v_requester_role IN ('priest', 'volunteer')
        AND v_category IN ('general', 'report_problem') THEN
    NULL; -- (b) a Priest's or Volunteer's General Question or Report a problem ticket
  ELSE
    RAISE EXCEPTION 'This ticket cannot be sent back to the church.' USING ERRCODE = '22023';
  END IF;

  IF v_church IS NULL OR NOT public.church_has_admin(v_church) THEN
    RAISE EXCEPTION 'This church has no administrator to send the ticket back to.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'The Super Admin') INTO v_name
  FROM public.profiles p WHERE p.id = v_uid;

  SELECT COALESCE(array_agg(p.id), ARRAY[]::uuid[]) INTO v_super_admins
  FROM public.profiles p WHERE p.role::text = 'super_admin';

  -- The Super Admin leaves the ticket: participant rows and unread notifications go
  DELETE FROM public.conversation_participants
  WHERE conversation_id = p_ticket_id AND user_id = ANY (v_super_admins);

  DELETE FROM public.notifications n
  WHERE n.user_id = ANY (v_super_admins)
    AND COALESCE(n.is_read, false) = false
    AND n.link LIKE '%' || p_ticket_id::text || '%';

  UPDATE public.conversations
  SET sent_back_at = now(),
      escalated_at = NULL,
      ticket_lane = 'church',
      updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  SELECT p_ticket_id, p.id
  FROM public.profiles p
  WHERE p.role::text = 'church_admin'
    AND (p.church_id = v_church OR p.assigned_church_id = v_church)
    AND p.id IS DISTINCT FROM v_requester
  ON CONFLICT DO NOTHING;

  INSERT INTO public.messages (conversation_id, sender_id, content, message_type, metadata)
  VALUES (
    p_ticket_id,
    v_uid,
    v_name || ' sent this ticket back to the Church Admin: ' || v_note,
    'system',
    jsonb_build_object('event', 'ticket_sent_back')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_send_back(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_send_back(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
