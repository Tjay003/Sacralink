-- =========================================================
-- MIGRATION 073: Request-user-deletion ticket (ticket 17)
-- =========================================================
-- A Church Admin cannot delete accounts; they file a "user_deletion_request" platform ticket naming a user of
-- their own church. This migration:
--   1. adds conversations.subject_user_id (the person a deletion request or "Report a person" ticket is about),
--   2. replaces the ticket_deletion_requests_enabled() stub from 064 with true,
--   3. redefines create_ticket() (064 + the assert_account_active sweep of 066) with the deletion-request rules,
--   4. keeps subject_user_id write-once: only create_ticket sets it.
-- Additive and idempotent.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS subject_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_open_deletion_subject
  ON public.conversations(subject_user_id)
  WHERE category = 'user_deletion_request' AND status IN ('open', 'in_progress');

CREATE OR REPLACE FUNCTION public.ticket_deletion_requests_enabled()
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$ SELECT true; $$;

REVOKE ALL ON FUNCTION public.ticket_deletion_requests_enabled() FROM PUBLIC;

-- subject_user_id cannot be re-pointed after creation by a signed-in user
CREATE OR REPLACE FUNCTION public.guard_ticket_subject_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' AND NEW.subject_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'Tickets are created with create_ticket().';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.subject_user_id IS DISTINCT FROM OLD.subject_user_id THEN
      RAISE EXCEPTION 'The person a ticket is about cannot be changed.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ticket_subject_user ON public.conversations;
CREATE TRIGGER trg_guard_ticket_subject_user
  BEFORE INSERT OR UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.guard_ticket_subject_user();

CREATE OR REPLACE FUNCTION public.create_ticket(p_lane text, p_church_id uuid, p_category text, p_subject text, p_message text, p_linked_ticket_id uuid DEFAULT NULL::uuid, p_subject_user_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
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
  v_linked record;
  v_title text;
  v_event text;
  v_subject_name text;
  v_subject_role text;
  v_subject_church uuid;
  v_subject_assigned uuid;
  v_subject_deleted timestamptz;
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
  IF p_subject_user_id IS NOT NULL AND p_category NOT IN ('user_deletion_request', 'report_person') THEN
    RAISE EXCEPTION 'A subject user is only allowed on a user deletion request or a report about a person.';
  END IF;
  IF p_category = 'user_deletion_request' AND p_subject_user_id IS NULL THEN
    RAISE EXCEPTION 'Choose the user you want deleted.';
  END IF;
  IF p_subject_user_id IS NOT NULL AND p_lane <> 'platform' THEN
    RAISE EXCEPTION 'A subject user is only allowed on a platform ticket.';
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

    -- The person a deletion request or a "Report a person" ticket is about: own church, not yourself, not the Super Admin
    IF p_subject_user_id IS NOT NULL THEN
      SELECT p.full_name, p.role::text, p.church_id, p.assigned_church_id, p.deleted_at
        INTO v_subject_name, v_subject_role, v_subject_church, v_subject_assigned, v_subject_deleted
      FROM public.profiles p
      WHERE p.id = p_subject_user_id;

      IF NOT FOUND
         OR (v_subject_church IS DISTINCT FROM p_church_id AND v_subject_assigned IS DISTINCT FROM p_church_id) THEN
        RAISE EXCEPTION 'You can only name a person of your own church.';
      END IF;
      IF p_subject_user_id = v_uid THEN
        RAISE EXCEPTION 'You cannot name yourself.';
      END IF;
      IF v_subject_role = 'super_admin' THEN
        RAISE EXCEPTION 'The Super Admin cannot be named in this kind of ticket.';
      END IF;
      IF v_subject_deleted IS NOT NULL THEN
        RAISE EXCEPTION 'That account has already been deleted.';
      END IF;
    END IF;

    IF p_category = 'user_deletion_request' THEN
      IF length(v_message) < 20 THEN
        RAISE EXCEPTION 'Please give a reason of at least 20 characters so the Super Admin can decide.';
      END IF;
      -- One open request per user, whoever filed it
      PERFORM pg_advisory_xact_lock(hashtext('deletion-request:' || p_subject_user_id::text));
      IF EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.category = 'user_deletion_request' AND c.subject_user_id = p_subject_user_id
          AND c.status IN ('open', 'in_progress')
      ) THEN
        RAISE EXCEPTION 'There is already an open deletion request for this user.';
      END IF;
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

  IF p_category = 'user_deletion_request' THEN
    v_title := 'Deletion request: ' || COALESCE(NULLIF(btrim(v_subject_name), ''), 'Unnamed user');
    v_subject := v_title;
    v_event := 'user_deletion_request';
  ELSE
    v_title := 'Inquiry: ' || v_subject;
  END IF;

  INSERT INTO public.conversations (title, type, church_id, created_by, category, status, ticket_number, ticket_lane, linked_ticket_id, subject_user_id)
  VALUES (v_title, 'group', p_church_id, v_uid, p_category, 'open', v_ticket_number, p_lane, p_linked_ticket_id, p_subject_user_id)
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
      'subject_user_id', p_subject_user_id,
      'event', v_event
    ))
  );

  RETURN v_conversation_id;
END;
$$;


REVOKE ALL ON FUNCTION public.create_ticket(text, uuid, text, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ticket(text, uuid, text, text, text, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
