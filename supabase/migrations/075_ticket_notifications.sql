-- 075: in-app notifications for ticket activity (ticket 16).
--
-- Notifications are written by database triggers, never by the browser, so a client cannot skip them or
-- notify the wrong people. Every status, assignment, escalation, reopen and send-back already leaves a
-- system message whose sender is the actor and whose metadata names the event, so the messages trigger
-- reads the actor from the row instead of guessing from auth.uid(). A new ticket is caught on the
-- conversations insert.
--
-- Every recipient must pass the same read rule as RLS (the requester, or public.is_ticket_handler on the
-- state AFTER the change), so nobody who cannot read the ticket is ever notified: not an unassigned
-- Priest/Volunteer, a previous assignee, another church Church Admin, the Super Admin on a
-- non-escalated church ticket, and after escalation neither the assignee nor the Church Admin.

-- Writes one notification. ticket_reply collapses: an unread ticket_reply for the same ticket is refreshed
-- instead of adding another row.
CREATE OR REPLACE FUNCTION public._ticket_notify_one(
  p_conversation_id uuid,
  p_recipient uuid,
  p_type text,
  p_title text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link text := '/messages?conv=' || p_conversation_id::text;
  v_existing uuid;
BEGIN
  IF p_type = 'ticket_reply' THEN
    SELECT n.id INTO v_existing
    FROM public.notifications n
    WHERE n.user_id = p_recipient AND n.type = 'ticket_reply' AND n.link = v_link
      AND COALESCE(n.is_read, false) = false
    ORDER BY n.created_at DESC
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      UPDATE public.notifications
      SET title = p_title, message = p_message, created_at = now()
      WHERE id = v_existing;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
  VALUES (p_recipient, p_type, p_title, p_message, v_link, false);
END;
$$;

-- Notifies every candidate who may read the ticket, never the actor and never a blocked account.
CREATE OR REPLACE FUNCTION public._ticket_notify_candidates(
  p_conversation_id uuid,
  p_actor uuid,
  p_candidates uuid[],
  p_type text,
  p_title text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester uuid;
  v_uid uuid;
BEGIN
  SELECT c.created_by INTO v_requester FROM public.conversations c WHERE c.id = p_conversation_id;

  FOR v_uid IN SELECT DISTINCT u FROM unnest(p_candidates) AS u WHERE u IS NOT NULL LOOP
    CONTINUE WHEN v_uid IS NOT DISTINCT FROM p_actor;
    CONTINUE WHEN public.is_user_blocked(v_uid);
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid);
    CONTINUE WHEN NOT (v_uid IS NOT DISTINCT FROM v_requester OR public.is_ticket_handler(p_conversation_id, v_uid));
    PERFORM public._ticket_notify_one(p_conversation_id, v_uid, p_type, p_title, p_message);
  END LOOP;
END;
$$;

-- One trigger function for both tables
CREATE OR REPLACE FUNCTION public.notify_ticket_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_number text;
  v_subject text;
  v_lane text;
  v_church uuid;
  v_requester uuid;
  v_assignee uuid;
  v_actor uuid;
  v_actor_name text;
  v_actor_role text;
  v_event text;
  v_by text;
  v_target uuid;
  v_handlers uuid[];
  v_admins uuid[];
  v_supers uuid[];
  v_assignee_if_admin uuid[];
BEGIN
  IF TG_TABLE_NAME = 'conversations' THEN
    IF NEW.ticket_number IS NULL THEN
      RETURN NEW;
    END IF;
    v_conv_id := NEW.id;
    v_actor := NEW.created_by;
    v_event := 'new';
  ELSE
    v_conv_id := NEW.conversation_id;
    v_actor := NEW.sender_id;
    IF NEW.message_type = 'system' THEN
      v_event := NEW.metadata ->> 'event';
      -- Automatic status flips (a first reply, a requester reply on a Resolved ticket) already produce a reply notification
      IF v_event = 'ticket_status_changed' AND COALESCE((NEW.metadata ->> 'automatic')::boolean, false) THEN
        RETURN NEW;
      END IF;
    ELSIF NEW.metadata ? 'ticket_number' THEN
      -- The opening message of a ticket is covered by the new-ticket notification
      RETURN NEW;
    ELSE
      v_event := 'reply';
    END IF;
  END IF;

  SELECT c.ticket_number, COALESCE(NULLIF(btrim(c.title), ''), 'Ticket'), c.ticket_lane, c.church_id,
         c.created_by, c.assigned_to
    INTO v_number, v_subject, v_lane, v_church, v_requester, v_assignee
  FROM public.conversations c
  WHERE c.id = v_conv_id AND c.ticket_number IS NOT NULL;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'Someone'), p.role::text
    INTO v_actor_name, v_actor_role
  FROM public.profiles p WHERE p.id = v_actor;
  v_actor_name := COALESCE(v_actor_name, 'Someone');

  SELECT COALESCE(array_agg(p.id), ARRAY[]::uuid[]) INTO v_admins
  FROM public.profiles p
  WHERE p.role::text = 'church_admin' AND v_church IS NOT NULL
    AND (p.church_id = v_church OR p.assigned_church_id = v_church);

  SELECT COALESCE(array_agg(p.id), ARRAY[]::uuid[]) INTO v_supers
  FROM public.profiles p WHERE p.role::text = 'super_admin';

  -- Everyone who could handle the ticket; each is still checked against the read rule when notified
  v_handlers := v_admins || v_supers || CASE WHEN v_assignee IS NULL THEN ARRAY[]::uuid[] ELSE ARRAY[v_assignee] END;
  -- The assignee is told about a status change only when the Church Admin made it
  v_assignee_if_admin := CASE WHEN v_actor_role = 'church_admin' AND v_assignee IS NOT NULL THEN ARRAY[v_assignee] ELSE ARRAY[]::uuid[] END;

  IF v_event = 'new' THEN
    PERFORM public._ticket_notify_candidates(
      v_conv_id, v_actor,
      CASE WHEN v_lane = 'platform' THEN v_supers ELSE v_admins END,
      'ticket_new', v_number || ': New ticket from ' || v_actor_name, v_subject
    );

  ELSIF v_event = 'reply' THEN
    IF v_actor IS NOT DISTINCT FROM v_requester THEN
      PERFORM public._ticket_notify_candidates(
        v_conv_id, v_actor, v_handlers, 'ticket_reply', v_number || ': ' || v_actor_name || ' replied', v_subject
      );
    ELSE
      PERFORM public._ticket_notify_candidates(
        v_conv_id, v_actor, ARRAY[v_requester], 'ticket_reply', v_number || ': ' || v_actor_name || ' replied', v_subject
      );
    END IF;

  ELSIF v_event = 'ticket_assigned' THEN
    -- Only an assignment notifies; an unassign carries no "to"
    IF NULLIF(NEW.metadata ->> 'to', '') IS NOT NULL THEN
      v_target := (NEW.metadata ->> 'to')::uuid;
      PERFORM public._ticket_notify_candidates(
        v_conv_id, v_actor, ARRAY[v_target], 'ticket_assigned', v_number || ': Assigned to you', v_subject
      );
    END IF;

  ELSIF v_event = 'ticket_status_changed' THEN
    PERFORM public._ticket_notify_candidates(
      v_conv_id, v_actor, ARRAY[v_requester] || v_assignee_if_admin, 'ticket_status',
      v_number || ': Status changed to ' || replace(COALESCE(NEW.metadata ->> 'to', 'updated'), '_', ' '),
      v_subject
    );

  ELSIF v_event = 'ticket_escalated' THEN
    PERFORM public._ticket_notify_candidates(
      v_conv_id, v_actor, v_supers || ARRAY[v_requester], 'ticket_escalated',
      v_number || ': Escalated to the Super Admin', v_subject
    );

  ELSIF v_event = 'ticket_reopened' THEN
    v_by := NEW.metadata ->> 'by';
    IF v_by = 'requester' THEN
      PERFORM public._ticket_notify_candidates(
        v_conv_id, v_actor, v_handlers, 'ticket_status', v_number || ': ' || v_actor_name || ' reopened the ticket', v_subject
      );
    ELSE
      PERFORM public._ticket_notify_candidates(
        v_conv_id, v_actor, ARRAY[v_requester] || v_assignee_if_admin, 'ticket_status', v_number || ': Ticket reopened', v_subject
      );
    END IF;

  ELSIF v_event = 'ticket_sent_back' THEN
    -- The requester and the church Church Admins; the Super Admin no longer reads the ticket and is never notified
    PERFORM public._ticket_notify_candidates(
      v_conv_id, v_actor, ARRAY[v_requester] || v_admins, 'ticket_sent_back',
      v_number || ': Sent back to the church', v_subject
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._ticket_notify_one(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._ticket_notify_candidates(uuid, uuid, uuid[], text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_ticket_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_ticket_new ON public.conversations;
CREATE TRIGGER trg_notify_ticket_new
  AFTER INSERT ON public.conversations
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NOT NULL)
  EXECUTE FUNCTION public.notify_ticket_event();

DROP TRIGGER IF EXISTS trg_notify_ticket_message ON public.messages;
CREATE TRIGGER trg_notify_ticket_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ticket_event();
