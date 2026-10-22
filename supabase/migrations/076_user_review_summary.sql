-- =========================================================
-- MIGRATION 076: Super Admin review summary for a person (ticket 18)
-- =========================================================
-- Gives the Super Admin evidence before they decide on a deletion request or a "Report a person" ticket.
-- Uses only data that already exists (no new logging). Super Admin only, because it reads auth.users
-- (last sign-in), which clients cannot. It never returns message text, donation amounts or file URLs:
-- only counts, profile facts and the action/entity/time of recent activity_logs rows.
-- Idempotent: safe to run more than once.

CREATE OR REPLACE FUNCTION public.get_user_review_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller uuid := auth.uid();
    v_profile public.profiles%ROWTYPE;
    v_church_name text;
    v_last_sign_in timestamptz;
    v_activity jsonb;
BEGIN
    PERFORM public.assert_account_active();
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_caller AND role::text = 'super_admin') THEN
        RAISE EXCEPTION 'Only the Super Admin can review a user' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT c.name INTO v_church_name
    FROM public.churches c
    WHERE c.id = COALESCE(v_profile.church_id, v_profile.assigned_church_id);

    SELECT u.last_sign_in_at INTO v_last_sign_in FROM auth.users u WHERE u.id = p_user_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'action', a.action,
               'entity_type', a.entity_type,
               'created_at', a.created_at
           ) ORDER BY a.created_at DESC), '[]'::jsonb)
    INTO v_activity
    FROM (
        SELECT l.action, l.entity_type, l.created_at
        FROM public.activity_logs l
        WHERE l.user_id = p_user_id
        ORDER BY l.created_at DESC
        LIMIT 10
    ) a;

    RETURN jsonb_build_object(
        'user_id', v_profile.id,
        'full_name', v_profile.full_name,
        'email', v_profile.email,
        'role', v_profile.role,
        'is_priest', COALESCE(v_profile.is_priest, false),
        'church_id', COALESCE(v_profile.church_id, v_profile.assigned_church_id),
        'church_name', v_church_name,
        'created_at', v_profile.created_at,
        'last_sign_in_at', v_last_sign_in,
        'suspended_at', v_profile.suspended_at,
        'deleted_at', v_profile.deleted_at,
        'counts', jsonb_build_object(
            'appointments', (SELECT count(*) FROM public.appointments x WHERE x.user_id = p_user_id),
            'appointments_cancelled', (SELECT count(*) FROM public.appointments x WHERE x.user_id = p_user_id AND x.status = 'cancelled'),
            'donations', (SELECT count(*) FROM public.donations x WHERE x.user_id = p_user_id),
            'donations_rejected', (SELECT count(*) FROM public.donations x WHERE x.user_id = p_user_id AND x.status = 'rejected'),
            'messages_sent', (SELECT count(*) FROM public.messages x WHERE x.sender_id = p_user_id),
            'tickets_raised', (SELECT count(*) FROM public.conversations x WHERE x.created_by = p_user_id AND x.ticket_number IS NOT NULL)
        ),
        'recent_activity', v_activity
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_review_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_review_summary(uuid) TO authenticated;
