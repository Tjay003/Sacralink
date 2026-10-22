-- =========================================================
-- MIGRATION 077: Decision actions on a deletion request (ticket 20)
-- =========================================================
-- The Super Admin decides a user_deletion_request ticket with one of three actions. Each acts on the ticket and
-- on the subject user in one transaction, so the ticket never says one thing while the account says another.
--   ticket_request_delete  : anonymize_user (066) on the subject, ticket Resolved
--   ticket_request_suspend : suspend_user (068) with a reason, ticket In Progress
--   ticket_request_decline : ticket Closed with a note to the Church Admin; the subject is not touched
-- Reactivation stays reactivate_user (068). The status system note uses the ticket_status_changed event so the
-- ticket notification trigger (075) tells the requesting Church Admin without extra code here.
-- Idempotent: safe to run more than once.

-- Shared checks: caller is the Super Admin, the ticket is an open deletion request. Locks the ticket row.
CREATE OR REPLACE FUNCTION public._deletion_request_for_decision(p_ticket_id uuid)
RETURNS TABLE (caller_name text, subject_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_ticket public.conversations%ROWTYPE;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
    END IF;
    PERFORM public.assert_account_active();
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND role::text = 'super_admin') THEN
        RAISE EXCEPTION 'Only the Super Admin can decide a deletion request' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_ticket FROM public.conversations
    WHERE id = p_ticket_id AND ticket_number IS NOT NULL
    FOR UPDATE;
    IF v_ticket.id IS NULL THEN
        RAISE EXCEPTION 'Ticket not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_ticket.category IS DISTINCT FROM 'user_deletion_request' OR v_ticket.subject_user_id IS NULL THEN
        RAISE EXCEPTION 'This action is only available on a user deletion request' USING ERRCODE = '42501';
    END IF;
    IF v_ticket.status = 'closed' THEN
        RAISE EXCEPTION 'This request is already closed' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT COALESCE(NULLIF(btrim(p.full_name), ''), 'The Super Admin'), v_ticket.subject_user_id, v_ticket.status
    FROM public.profiles p WHERE p.id = v_uid;
END;
$$;

-- Sets the new status and writes the system note in the shape ticket_set_status uses.
CREATE OR REPLACE FUNCTION public._deletion_request_record(p_ticket_id uuid, p_from text, p_to text, p_content text, p_extra jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.conversations SET status = p_to, updated_at = now() WHERE id = p_ticket_id;
    INSERT INTO public.messages (conversation_id, sender_id, content, message_type, metadata)
    VALUES (p_ticket_id, auth.uid(), p_content, 'system',
            jsonb_build_object('event', 'ticket_status_changed', 'from', p_from, 'to', p_to) || COALESCE(p_extra, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public._deletion_request_for_decision(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._deletion_request_record(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Delete the subject and resolve the ticket.
CREATE OR REPLACE FUNCTION public.ticket_request_delete(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ctx record;
    v_subject public.profiles%ROWTYPE;
    v_subject_name text;
BEGIN
    SELECT * INTO v_ctx FROM public._deletion_request_for_decision(p_ticket_id);

    SELECT * INTO v_subject FROM public.profiles WHERE id = v_ctx.subject_id;
    IF v_subject.id IS NULL THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_subject.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'This account is already deleted. Decline the request to close it' USING ERRCODE = '42501';
    END IF;
    IF v_subject.role::text = 'super_admin' THEN
        RAISE EXCEPTION 'The Super Admin cannot be deleted' USING ERRCODE = '42501';
    END IF;
    IF v_subject.id = auth.uid() THEN
        RAISE EXCEPTION 'You cannot delete your own account here' USING ERRCODE = '42501';
    END IF;

    v_subject_name := COALESCE(NULLIF(btrim(v_subject.full_name), ''), 'the user');
    PERFORM public.anonymize_user(v_subject.id, auth.uid());
    PERFORM public._deletion_request_record(
        p_ticket_id, v_ctx.status, 'resolved',
        v_ctx.caller_name || ' deleted the account of ' || v_subject_name,
        jsonb_build_object('decision', 'deleted'));
END;
$$;

-- Suspend the subject and keep the ticket In Progress.
CREATE OR REPLACE FUNCTION public.ticket_request_suspend(p_ticket_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ctx record;
    v_subject public.profiles%ROWTYPE;
    v_subject_name text;
BEGIN
    SELECT * INTO v_ctx FROM public._deletion_request_for_decision(p_ticket_id);

    SELECT * INTO v_subject FROM public.profiles WHERE id = v_ctx.subject_id;
    IF v_subject.id IS NULL THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_subject.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'This account is already deleted. Decline the request to close it' USING ERRCODE = '42501';
    END IF;
    IF v_subject.suspended_at IS NOT NULL THEN
        RAISE EXCEPTION 'This account is already suspended. Delete it or decline the request' USING ERRCODE = '42501';
    END IF;

    v_subject_name := COALESCE(NULLIF(btrim(v_subject.full_name), ''), 'the user');
    PERFORM public.suspend_user(v_subject.id, p_reason);
    PERFORM public._deletion_request_record(
        p_ticket_id, v_ctx.status, 'in_progress',
        v_ctx.caller_name || ' suspended ' || v_subject_name || ' pending review',
        jsonb_build_object('decision', 'suspended'));
END;
$$;

-- Decline: close the ticket with a note to the Church Admin. The subject is never touched.
CREATE OR REPLACE FUNCTION public.ticket_request_decline(p_ticket_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ctx record;
    v_note text := btrim(COALESCE(p_note, ''));
BEGIN
    SELECT * INTO v_ctx FROM public._deletion_request_for_decision(p_ticket_id);
    IF char_length(v_note) < 10 THEN
        RAISE EXCEPTION 'Give the Church Admin a note of at least 10 characters' USING ERRCODE = '22023';
    END IF;
    PERFORM public._deletion_request_record(
        p_ticket_id, v_ctx.status, 'closed',
        'Request declined: ' || v_note,
        jsonb_build_object('decision', 'declined', 'note', v_note));
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_request_delete(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ticket_request_suspend(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ticket_request_decline(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_request_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_request_suspend(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_request_decline(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
