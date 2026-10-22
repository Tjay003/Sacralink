-- =========================================================
-- MIGRATION 069: Ticket handler assignment (ticket 13)
-- =========================================================
-- A Church Admin assigns a church-lane ticket to one Priest or Volunteer of their church, or takes it back.
-- Assignment is what grants access (spec decision 25). The live check in is_ticket_handler() and
-- can_access_conversation() (067) is the authority: the moment conversations.assigned_to changes, the previous
-- assignee stops reading the ticket. The participant row and notification cleanup below only keep lists and
-- badges tidy; no stale row can leak a ticket.
-- Also extends cleanup_staff_assignments (063) so a person who stops being church staff (demoted, moved or deleted)
-- is unassigned from every church ticket they were handling (spec decision 37).
-- Rollback: supabase/rollbacks/069_rollback_ticket_assignment.sql
-- Idempotent: safe to run more than once.

-- 1. Internal helper: end one person's involvement in a ticket (participant row and unread notifications).
--    Not granted to clients. The requester keeps their participant row.
CREATE OR REPLACE FUNCTION public.ticket_release_handler(p_ticket_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_number text;
    v_requester uuid;
BEGIN
    SELECT c.ticket_number, c.created_by INTO v_number, v_requester
    FROM public.conversations c WHERE c.id = p_ticket_id;

    IF p_user_id IS NULL OR p_user_id IS NOT DISTINCT FROM v_requester THEN
        RETURN;
    END IF;

    DELETE FROM public.conversation_participants
    WHERE conversation_id = p_ticket_id AND user_id = p_user_id;

    DELETE FROM public.notifications n
    WHERE n.user_id = p_user_id
      AND n.is_read = false
      AND (
          position(p_ticket_id::text IN COALESCE(n.link, '')) > 0
          OR (v_number IS NOT NULL AND position(v_number IN COALESCE(n.message, '') || ' ' || COALESCE(n.title, '')) > 0)
      );
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_release_handler(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 2. ticket_assign
CREATE OR REPLACE FUNCTION public.ticket_assign(p_ticket_id uuid, p_assignee uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_lane text;
    v_status text;
    v_church uuid;
    v_requester uuid;
    v_escalated timestamptz;
    v_old uuid;
    v_actor_name text;
    v_old_name text;
    v_new_name text;
    v_target record;
    v_text text;
BEGIN
    PERFORM public.assert_account_active();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to assign a ticket.' USING ERRCODE = '28000';
    END IF;

    SELECT c.ticket_lane, c.status, c.church_id, c.created_by, c.escalated_at, c.assigned_to
      INTO v_lane, v_status, v_church, v_requester, v_escalated, v_old
    FROM public.conversations c
    WHERE c.id = p_ticket_id AND c.ticket_number IS NOT NULL
    FOR UPDATE;

    IF NOT FOUND
       OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.role::text = 'church_admin')
       OR NOT public.is_ticket_handler(p_ticket_id, v_uid) THEN
        RAISE EXCEPTION 'Only the Church Admin of this church can assign this ticket.' USING ERRCODE = '42501';
    END IF;
    IF v_lane IS DISTINCT FROM 'church' THEN
        RAISE EXCEPTION 'Only parish office tickets can be assigned.' USING ERRCODE = '22023';
    END IF;
    IF v_escalated IS NOT NULL THEN
        RAISE EXCEPTION 'An escalated ticket cannot be assigned.' USING ERRCODE = '22023';
    END IF;
    IF v_status = 'closed' THEN
        RAISE EXCEPTION 'A closed ticket cannot be assigned.' USING ERRCODE = '22023';
    END IF;

    IF p_assignee IS NOT NULL THEN
        SELECT p.id, p.role::text AS role, p.church_id, p.assigned_church_id, p.deleted_at
          INTO v_target
        FROM public.profiles p WHERE p.id = p_assignee;

        IF v_target.id IS NULL OR v_target.deleted_at IS NOT NULL OR public.is_user_blocked(p_assignee) THEN
            RAISE EXCEPTION 'That person cannot be assigned this ticket.' USING ERRCODE = '22023';
        END IF;
        IF p_assignee = v_requester THEN
            RAISE EXCEPTION 'A ticket cannot be assigned to the person who raised it.' USING ERRCODE = '22023';
        END IF;
        IF v_target.role NOT IN ('priest', 'volunteer')
           OR (v_target.church_id IS DISTINCT FROM v_church AND v_target.assigned_church_id IS DISTINCT FROM v_church) THEN
            RAISE EXCEPTION 'Tickets can only be assigned to a Priest or Volunteer of this church.' USING ERRCODE = '22023';
        END IF;
    END IF;

    IF v_old IS NOT DISTINCT FROM p_assignee THEN
        RETURN;
    END IF;

    UPDATE public.conversations
    SET assigned_to = p_assignee, updated_at = now()
    WHERE id = p_ticket_id;

    IF v_old IS NOT NULL THEN
        PERFORM public.ticket_release_handler(p_ticket_id, v_old);
    END IF;
    IF p_assignee IS NOT NULL THEN
        INSERT INTO public.conversation_participants (conversation_id, user_id)
        VALUES (p_ticket_id, p_assignee)
        ON CONFLICT DO NOTHING;
    END IF;

    SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'The Church Admin') INTO v_actor_name FROM public.profiles p WHERE p.id = v_uid;
    SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'a staff member') INTO v_new_name FROM public.profiles p WHERE p.id = p_assignee;
    SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'a staff member') INTO v_old_name FROM public.profiles p WHERE p.id = v_old;

    IF p_assignee IS NULL THEN
        v_text := v_actor_name || ' unassigned this ticket from ' || v_old_name || '.';
    ELSE
        v_text := v_actor_name || ' assigned this ticket to ' || v_new_name || '.';
    END IF;

    INSERT INTO public.messages (conversation_id, sender_id, content, message_type, metadata)
    VALUES (
        p_ticket_id, v_uid, v_text, 'system',
        jsonb_strip_nulls(jsonb_build_object('event', 'ticket_assigned', 'from', v_old, 'to', p_assignee))
    );
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_assign(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_assign(uuid, uuid) TO authenticated;

-- 3. Staff removal: channels as before (063), plus unassign every church ticket the person was handling.
CREATE OR REPLACE FUNCTION public.cleanup_staff_assignments(p_user_id uuid, p_church_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket record;
    v_name text;
    v_actor uuid := COALESCE(auth.uid(), p_user_id);
BEGIN
    DELETE FROM public.conversation_participants cp
    USING public.conversations c
    WHERE cp.conversation_id = c.id
      AND cp.user_id = p_user_id
      AND c.type = 'channel'
      AND c.church_id = p_church_id;

    SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'A staff member') INTO v_name
    FROM public.profiles p WHERE p.id = p_user_id;

    FOR v_ticket IN
        SELECT c.id FROM public.conversations c
        WHERE c.ticket_number IS NOT NULL
          AND c.ticket_lane = 'church'
          AND c.church_id = p_church_id
          AND c.assigned_to = p_user_id
        FOR UPDATE
    LOOP
        UPDATE public.conversations SET assigned_to = NULL, updated_at = now() WHERE id = v_ticket.id;
        PERFORM public.ticket_release_handler(v_ticket.id, p_user_id);
        INSERT INTO public.messages (conversation_id, sender_id, content, message_type, metadata)
        VALUES (
            v_ticket.id, v_actor,
            v_name || ' is no longer on staff; the ticket returned to the Church Admin.',
            'system',
            jsonb_build_object('event', 'ticket_unassigned_staff_removed', 'from', p_user_id)
        );
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_staff_assignments(uuid, uuid) FROM PUBLIC, anon, authenticated;
