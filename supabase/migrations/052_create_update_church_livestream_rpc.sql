-- ==============================================================================
-- MIGRATION 052: Create update_church_livestream RPC
-- Security-definer function allowing authorized church volunteers & admins
-- to update livestream metadata and toggle broadcast live status
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_church_livestream(
    p_church_id UUID,
    p_is_live BOOLEAN,
    p_livestream_url TEXT DEFAULT NULL,
    p_livestream_title TEXT DEFAULT NULL,
    p_livestream_platform TEXT DEFAULT 'youtube'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_role user_role;
    v_assigned_church UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT role, COALESCE(assigned_church_id, church_id)
    INTO v_user_role, v_assigned_church
    FROM profiles
    WHERE id = v_user_id;

    IF v_user_role NOT IN ('super_admin', 'admin') AND (v_assigned_church IS NULL OR v_assigned_church <> p_church_id) THEN
        RAISE EXCEPTION 'Permission denied to manage this church livestream';
    END IF;

    UPDATE churches
    SET 
        is_live = p_is_live,
        livestream_url = COALESCE(p_livestream_url, livestream_url),
        livestream_title = COALESCE(p_livestream_title, livestream_title),
        livestream_platform = COALESCE(p_livestream_platform, livestream_platform, 'youtube'),
        livestream_started_at = CASE WHEN p_is_live THEN NOW() ELSE livestream_started_at END,
        updated_at = NOW()
    WHERE id = p_church_id;

    RETURN jsonb_build_object('success', true, 'is_live', p_is_live);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_church_livestream(UUID, BOOLEAN, TEXT, TEXT, TEXT) TO authenticated;
