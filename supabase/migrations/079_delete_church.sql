-- =========================================================
-- MIGRATION 079: Deleting a church through the database
-- =========================================================
-- Until now the web app deleted a church with a plain DELETE. That cascaded away appointments, donations and
-- schedules, left staff with a staff role and no church, and failed outright when the church had activity-log rows.
-- public.church_deletion_impact tells the Super Admin exactly what a deletion removes; public.delete_church does it:
--   * every person of the church becomes a Parishioner with no church (the Super Admin keeps the role),
--   * the church's staff channel is removed, other conversations keep their history but lose the church link,
--   * the audit trail keeps its rows (their church link is cleared) and records who deleted which church,
--   * the church and everything that cascades from it is deleted in one transaction.
-- Idempotent: safe to run more than once.

CREATE OR REPLACE FUNCTION public.church_deletion_impact(p_church_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_church public.churches%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL OR public.get_current_user_role()::text <> 'super_admin' THEN
        RAISE EXCEPTION 'Only the Super Admin can delete a church' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_church FROM public.churches WHERE id = p_church_id;
    IF v_church.id IS NULL THEN
        RAISE EXCEPTION 'Church not found' USING ERRCODE = 'P0002';
    END IF;

    RETURN jsonb_build_object(
        'name', v_church.name,
        'church_admins', (SELECT count(*) FROM public.profiles WHERE role::text = 'church_admin' AND p_church_id IN (assigned_church_id, church_id)),
        'priests', (SELECT count(*) FROM public.profiles WHERE role::text = 'priest' AND p_church_id IN (assigned_church_id, church_id)),
        'volunteers', (SELECT count(*) FROM public.profiles WHERE role::text = 'volunteer' AND p_church_id IN (assigned_church_id, church_id)),
        'appointments', (SELECT count(*) FROM public.appointments WHERE church_id = p_church_id),
        'donations', (SELECT count(*) FROM public.donations WHERE church_id = p_church_id),
        'donation_total', (SELECT COALESCE(sum(amount), 0) FROM public.donations WHERE church_id = p_church_id),
        'mass_schedules', (SELECT count(*) FROM public.mass_schedules WHERE church_id = p_church_id),
        'announcements', (SELECT count(*) FROM public.church_announcements WHERE church_id = p_church_id),
        'images', (SELECT count(*) FROM public.church_images WHERE church_id = p_church_id),
        'conversations_kept', (SELECT count(*) FROM public.conversations WHERE church_id = p_church_id AND type::text <> 'channel')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.church_deletion_impact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.church_deletion_impact(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_church(p_church_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_impact jsonb;
    v_person record;
BEGIN
    PERFORM public.assert_account_active();

    -- Raises for anyone but the Super Admin, and when the church does not exist
    v_impact := public.church_deletion_impact(p_church_id);

    -- Serialize with role changes in this church
    PERFORM pg_advisory_xact_lock(hashtext('set_user_role:' || p_church_id::text));

    -- Staff of this church stop being staff: clean up their channel membership first, then demote them.
    FOR v_person IN
        SELECT id FROM public.profiles
        WHERE role::text IN ('volunteer', 'priest', 'church_admin') AND p_church_id IN (assigned_church_id, church_id)
    LOOP
        PERFORM public.cleanup_staff_assignments(v_person.id, p_church_id);
    END LOOP;

    -- Role and church columns are guarded by a trigger (063); this is the other sanctioned path besides set_user_role.
    PERFORM set_config('app.role_change_ok', '1', true);
    UPDATE public.profiles
    SET role = 'user',
        assigned_church_id = NULL,
        church_id = NULL,
        is_priest = false,
        updated_at = now()
    WHERE role::text IN ('volunteer', 'priest', 'church_admin') AND p_church_id IN (assigned_church_id, church_id);

    -- Everyone else linked to the church (parishioners with a home parish, a Super Admin) only loses the link.
    UPDATE public.profiles
    SET assigned_church_id = CASE WHEN assigned_church_id = p_church_id THEN NULL ELSE assigned_church_id END,
        church_id = CASE WHEN church_id = p_church_id THEN NULL ELSE church_id END,
        updated_at = now()
    WHERE p_church_id IN (assigned_church_id, church_id);
    PERFORM set_config('app.role_change_ok', '', true);

    -- The church's staff channel has no purpose without it; other conversations keep their history.
    DELETE FROM public.conversations WHERE church_id = p_church_id AND type::text = 'channel';

    -- Keep the audit trail, but release the foreign key that blocks the delete
    UPDATE public.activity_logs SET church_id = NULL WHERE church_id = p_church_id;

    DELETE FROM public.churches WHERE id = p_church_id;

    INSERT INTO public.activity_logs (user_id, church_id, action, entity_type, entity_id, metadata)
    VALUES (v_uid, NULL, 'delete_church', 'churches', p_church_id, v_impact);

    RETURN v_impact;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_church(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_church(uuid) TO authenticated;
