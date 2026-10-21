-- ============================================================================
-- Migration 061: Volunteer messaging scope and live unread-message count
-- ============================================================================
-- Ticket status in this schema is conversations.status ('open' | 'in_progress' | 'resolved' | 'closed'),
-- and a Parish Office Ticket is conversations.type = 'group' AND ticket_number IS NOT NULL.
-- Migrations 041 and 059 already let the requester (created_by) and the parish staff
-- (church_admin / priest / volunteer, plus admin / super_admin) update that status and post replies,
-- so closing and reopening a ticket needs no new policy. This migration adds:
--
--   1. A RESTRICTIVE participant-insert policy: a volunteer can only start a Direct Message with
--      church admins or volunteers of their own parish. Never with parishioners, priests or other parishes.
--      The app also hides those people in the New Message search; this closes the direct API route.
--   2. get_my_unread_message_count(): the number of unread messages across the caller's conversations,
--      used by the sidebar Messages badge. Runs as the caller, so RLS still applies.
--
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

-- 1. Volunteer Direct Message scope (SECURITY DEFINER so the check does not recurse through RLS)
CREATE OR REPLACE FUNCTION public.volunteer_may_add_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_direct boolean;
BEGIN
  IF _uid IS NULL OR _user_id = _uid THEN
    RETURN true;
  END IF;

  -- Only volunteers are constrained by this policy
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _uid AND p.role::text = 'volunteer') THEN
    RETURN true;
  END IF;

  SELECT (c.type = 'direct') INTO _is_direct FROM public.conversations c WHERE c.id = _conversation_id;
  IF NOT COALESCE(_is_direct, false) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles me
    JOIN public.profiles target ON target.id = _user_id
    WHERE me.id = _uid
      AND target.role::text IN ('church_admin', 'volunteer')
      AND COALESCE(target.is_priest, false) = false
      AND (
        (me.church_id IS NOT NULL AND (me.church_id = target.church_id OR me.church_id = target.assigned_church_id))
        OR (me.assigned_church_id IS NOT NULL AND (me.assigned_church_id = target.church_id OR me.assigned_church_id = target.assigned_church_id))
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.volunteer_may_add_participant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.volunteer_may_add_participant(uuid, uuid) TO authenticated, anon;

DROP POLICY IF EXISTS "Volunteers only message their own parish staff" ON public.conversation_participants;

CREATE POLICY "Volunteers only message their own parish staff"
ON public.conversation_participants AS RESTRICTIVE FOR INSERT
WITH CHECK (public.volunteer_may_add_participant(conversation_id, user_id));

-- 2. Unread message count for the sidebar badge
CREATE OR REPLACE FUNCTION public.get_my_unread_message_count()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.messages m
  JOIN public.conversation_participants cp
    ON cp.conversation_id = m.conversation_id
   AND cp.user_id = auth.uid()
  WHERE m.sender_id <> auth.uid()
    AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at);
$$;

REVOKE ALL ON FUNCTION public.get_my_unread_message_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_unread_message_count() TO authenticated;
