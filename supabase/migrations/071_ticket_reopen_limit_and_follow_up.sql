-- =========================================================
-- MIGRATION 071: Reopen limit and linked follow-up ticket
-- =========================================================
-- A requester may reopen a Closed ticket at most twice; the handler may always reopen. The count lives in
-- conversations.reopen_count (migration 064), changed only inside ticket_reopen(), under the same row lock that checks it.
-- create_ticket() now validates a follow-up link: the caller's own Closed ticket with both reopens used.
-- Requires 064, 066 (assert_account_active) and 067 (is_ticket_handler, column lock). Additive and idempotent.

CREATE OR REPLACE FUNCTION public.ticket_reopen(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_requester uuid;
  v_count smallint;
  v_by text;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to reopen a ticket.' USING ERRCODE = '28000';
  END IF;
  PERFORM public.assert_account_active();

  SELECT c.status, c.created_by, c.reopen_count INTO v_status, v_requester, v_count
  FROM public.conversations c
  WHERE c.id = p_ticket_id AND c.ticket_number IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You cannot reopen this ticket.' USING ERRCODE = '42501';
  END IF;
  IF v_status IS DISTINCT FROM 'closed' THEN
    RAISE EXCEPTION 'Only a closed ticket can be reopened.' USING ERRCODE = '22023';
  END IF;

  IF public.is_ticket_handler(p_ticket_id, v_uid) THEN
    v_by := 'handler';
    UPDATE public.conversations SET status = 'open', updated_at = now() WHERE id = p_ticket_id;
  ELSIF v_requester = v_uid THEN
    IF v_count >= 2 THEN
      RAISE EXCEPTION 'You have reached the reopen limit. Raise a new ticket instead.' USING ERRCODE = '23514';
    END IF;
    v_by := 'requester';
    UPDATE public.conversations
    SET status = 'open', reopen_count = reopen_count + 1, updated_at = now()
    WHERE id = p_ticket_id;
  ELSE
    RAISE EXCEPTION 'You cannot reopen this ticket.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'A participant') INTO v_name
  FROM public.profiles p WHERE p.id = v_uid;

  INSERT INTO public.messages (conversation_id, sender_id, content, message_type, metadata)
  VALUES (
    p_ticket_id,
    v_uid,
    v_name || ' reopened this ticket.',
    'system',
    jsonb_build_object('event', 'ticket_reopened', 'by', v_by)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_reopen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_reopen(uuid) TO authenticated;

-- create_ticket: follow-up validation and inherited defaults (current definition from migration 064 plus later sweeps)
CREATE OR REPLACE FUNCTION public.create_ticket(p_lane text, p_church_id uuid, p_category text, p_subject text, p_message text, p_linked_ticket_id uuid DEFAULT NULL::uuid, p_subject_user_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_linked record;
  v_role text;
  v_home_church uuid;
  v_assigned_church uuid;
  v_subject text := btrim(COALESCE(p_subject, ''));
  v_message text := btrim(COALESCE(p_message, ''));
  v_church_categories text[] := ARRAY['baptism', 'wedding', 'funeral', 'mass_intention', 'certificate', 'general'];
  v_allowed text[];
  v_super_admin uuid;
  v_open_count integer;
  v_ticket_number text;
  v_conversation_id uuid;
BEGIN
  PERFORM public.assert_account_active();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create a ticket.';
  END IF;

  -- A follow-up inherits lane, church and category from the ticket it continues when the caller leaves them out
  IF p_linked_ticket_id IS NOT NULL THEN
    SELECT c.ticket_lane, c.church_id, c.category INTO v_linked
    FROM public.conversations c
    WHERE c.id = p_linked_ticket_id AND c.ticket_number IS NOT NULL AND c.created_by = v_uid;
    IF FOUND THEN
      p_lane := COALESCE(p_lane, v_linked.ticket_lane);
      p_church_id := COALESCE(p_church_id, v_linked.church_id);
      p_category := COALESCE(p_category, v_linked.category);
    END IF;
  END IF;

  SELECT p.role::text, p.church_id, p.assigned_church_id
    INTO v_role, v_home_church, v_assigned_church
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;
  IF v_role = 'super_admin' THEN
    RAISE EXCEPTION 'The Super Admin cannot create tickets.';
  END IF;
  IF v_role NOT IN ('user', 'volunteer', 'church_admin', 'priest') THEN
    RAISE EXCEPTION 'Your role cannot create tickets.';
  END IF;
  IF p_lane IS NULL OR p_lane NOT IN ('church', 'platform') THEN
    RAISE EXCEPTION 'Unknown ticket lane.';
  END IF;
  IF length(v_subject) < 3 THEN
    RAISE EXCEPTION 'Subject must be at least 3 characters long.';
  END IF;
  IF length(v_message) < 10 THEN
    RAISE EXCEPTION 'Message must be at least 10 characters long.';
  END IF;
  IF p_church_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.churches WHERE id = p_church_id) THEN
    RAISE EXCEPTION 'Church not found.';
  END IF;
  IF p_category IS NULL THEN
    RAISE EXCEPTION 'Choose a category.';
  END IF;

  -- One request per caller at a time, so two simultaneous requests cannot both slip past a limit
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text));

  IF p_linked_ticket_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_linked_ticket_id AND c.ticket_number IS NOT NULL AND c.created_by = v_uid
  ) THEN
    RAISE EXCEPTION 'The ticket you are following up on was not found.';
  END IF;
  -- A follow-up exists only for a requester who has used both reopens on a closed ticket
  IF p_linked_ticket_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_linked_ticket_id AND c.status = 'closed' AND c.reopen_count >= 2
  ) THEN
    RAISE EXCEPTION 'You can raise a follow-up only after a closed ticket has been reopened twice.' USING ERRCODE = '23514';
  END IF;
  IF p_subject_user_id IS NOT NULL AND p_category <> 'user_deletion_request' THEN
    RAISE EXCEPTION 'A subject user is only allowed on a user deletion request.';
  END IF;

  IF p_lane = 'church' THEN
    -- Parish office: Parishioners and Volunteers only
    IF v_role NOT IN ('user', 'volunteer') THEN
      RAISE EXCEPTION 'Church staff contact the Super Admin through a platform ticket.';
    END IF;
    IF NOT (p_category = ANY (v_church_categories)) THEN
      RAISE EXCEPTION 'That category is not available for the parish office.';
    END IF;
    IF NOT public.church_has_admin(p_church_id) THEN
      RAISE EXCEPTION 'This church has no administrator yet. You can report a concern about the church instead.';
    END IF;
  ELSE
    -- Platform lane: straight to the Super Admin
    SELECT p.id INTO v_super_admin FROM public.profiles p WHERE p.role = 'super_admin' ORDER BY p.created_at LIMIT 1;
    IF v_super_admin IS NULL THEN
      RAISE EXCEPTION 'There is no Super Admin to receive this ticket.';
    END IF;

    IF v_role = 'user' THEN
      v_allowed := ARRAY['report_church'];
    ELSE
      IF p_church_id IS DISTINCT FROM v_home_church AND p_church_id IS DISTINCT FROM v_assigned_church THEN
        RAISE EXCEPTION 'A platform ticket from church staff must be about your own church.';
      END IF;
      IF v_role = 'church_admin' THEN
        v_allowed := ARRAY['general', 'user_deletion_request', 'church_setup', 'report_problem', 'report_person'];
      ELSE
        v_allowed := ARRAY['general', 'report_problem', 'report_person'];
      END IF;
    END IF;

    IF NOT (p_category = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'That category is not available for your role.';
    END IF;
    IF p_category = 'user_deletion_request' AND NOT public.ticket_deletion_requests_enabled() THEN
      RAISE EXCEPTION 'User deletion requests are not available yet.';
    END IF;

    -- Rate limits count only tickets that are still open or in progress
    IF p_category = 'user_deletion_request' THEN
      SELECT count(*) INTO v_open_count FROM public.conversations c
      WHERE c.created_by = v_uid AND c.ticket_lane = 'platform' AND c.category = 'user_deletion_request'
        AND c.status IN ('open', 'in_progress');
      IF v_open_count >= 5 THEN
        RAISE EXCEPTION 'You already have 5 open deletion requests. Wait for the Super Admin to decide on one before filing another.';
      END IF;
    ELSIF p_category = 'report_church' THEN
      SELECT count(*) INTO v_open_count FROM public.conversations c
      WHERE c.created_by = v_uid AND c.ticket_lane = 'platform' AND c.category = 'report_church'
        AND c.status IN ('open', 'in_progress');
      IF v_open_count >= 2 THEN
        RAISE EXCEPTION 'You already have 2 open concerns. Wait for a reply before raising another.';
      END IF;
    ELSE
      SELECT count(*) INTO v_open_count FROM public.conversations c
      WHERE c.created_by = v_uid AND c.ticket_lane = 'platform' AND c.category <> 'user_deletion_request'
        AND c.status IN ('open', 'in_progress');
      IF v_open_count >= 3 THEN
        RAISE EXCEPTION 'You already have 3 open tickets with the Super Admin. Wait for a reply or close one before raising another.';
      END IF;
    END IF;
  END IF;

  v_ticket_number := public.next_ticket_number();

  INSERT INTO public.conversations (title, type, church_id, created_by, category, status, ticket_number, ticket_lane, linked_ticket_id)
  VALUES ('Inquiry: ' || v_subject, 'group', p_church_id, v_uid, p_category, 'open', v_ticket_number, p_lane, p_linked_ticket_id)
  RETURNING id INTO v_conversation_id;

  -- Participants: the requester plus the Church Admins (church lane) or the Super Admin (platform lane)
  INSERT INTO public.conversation_participants (conversation_id, user_id, last_read_at)
  VALUES (v_conversation_id, v_uid, now());

  IF p_lane = 'church' THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    SELECT v_conversation_id, p.id
    FROM public.profiles p
    WHERE p.role = 'church_admin'
      AND (p.church_id = p_church_id OR p.assigned_church_id = p_church_id)
      AND p.id <> v_uid
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (v_conversation_id, v_super_admin)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content, message_type, metadata)
  VALUES (
    v_conversation_id,
    v_uid,
    '[Inquiry: ' || v_subject || E']\n\n' || v_message,
    'text',
    jsonb_strip_nulls(jsonb_build_object(
      'inquiry_subject', v_subject,
      'church_id', p_church_id,
      'category', p_category,
      'ticket_number', v_ticket_number,
      'ticket_lane', p_lane,
      'subject_user_id', p_subject_user_id
    ))
  );

  RETURN v_conversation_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
