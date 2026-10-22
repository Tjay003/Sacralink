-- =========================================================
-- MIGRATION 062: Retire the Admin role (data level)
-- =========================================================
-- The `admin` value stays in the user_role enum (Postgres cannot drop an enum value) but no profile may hold it.
-- Idempotent: safe to run more than once.

-- 1. transfer_super_admin: the previous owner becomes a Parishioner ('user') instead of 'admin'.
--    Everything else is identical to migration 026.
CREATE OR REPLACE FUNCTION public.transfer_super_admin(target_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID;
    caller_role TEXT;
    target_exists BOOLEAN;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: No active session');
    END IF;

    -- Verify caller is super_admin
    SELECT role INTO caller_role FROM public.profiles WHERE id = caller_id;
    IF caller_role IS NULL OR caller_role != 'super_admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Only the current Super Admin can transfer ownership');
    END IF;

    IF caller_id = target_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target user is already the Super Admin');
    END IF;

    -- Check target user exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = target_user_id) INTO target_exists;
    IF NOT target_exists THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target user not found');
    END IF;

    -- Atomic transfer:
    -- 1. Demote current super admin to a Parishioner (the Admin role no longer exists)
    UPDATE public.profiles
    SET role = 'user', updated_at = NOW()
    WHERE id = caller_id;

    -- 2. Promote target user to super_admin (clearing church assignments as super_admin oversees all)
    UPDATE public.profiles
    SET role = 'super_admin', assigned_church_id = NULL, church_id = NULL, updated_at = NOW()
    WHERE id = target_user_id;

    -- 3. Log to activity_logs
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
        caller_id,
        'transfer_super_admin',
        'profiles',
        target_user_id,
        jsonb_build_object('previous_owner_id', caller_id, 'new_owner_id', target_user_id)
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_super_admin(UUID) TO authenticated;

-- 2. Convert every existing admin account to a Parishioner. church_id and assigned_church_id are kept so
--    the account stays in its church. One activity_logs row per converted account makes the change traceable.
--    This runs before the guard trigger below exists, and sets role to 'user', so the trigger never objects.
WITH converted AS (
    UPDATE public.profiles
    SET role = 'user', is_priest = false, updated_at = NOW()
    WHERE role = 'admin'
    RETURNING id, COALESCE(assigned_church_id, church_id) AS kept_church_id
)
INSERT INTO public.activity_logs (user_id, church_id, action, entity_type, entity_id, metadata)
SELECT id, kept_church_id, 'admin_role_retired', 'profiles', id,
       jsonb_build_object('previous_role', 'admin', 'new_role', 'user')
FROM converted;

-- 3. Guard: nobody (service role included) can give a profile the retired role again.
CREATE OR REPLACE FUNCTION public.prevent_admin_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.role::text = 'admin' THEN
        RAISE EXCEPTION 'The Admin role no longer exists' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_admin_role ON public.profiles;
CREATE TRIGGER trg_prevent_admin_role
    BEFORE INSERT OR UPDATE OF role ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_role();
