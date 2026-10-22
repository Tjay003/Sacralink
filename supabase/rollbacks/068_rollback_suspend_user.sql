-- =========================================================
-- ROLLBACK for MIGRATION 068 (suspend and reactivate a user). Not applied by scripts/local-db-setup.ps1.
-- =========================================================
-- Reactivates every suspended account first (so nobody stays banned), then removes the functions and puts
-- is_user_blocked back to deleted-only. The three suspension columns are left in place (harmless, and they keep the
-- audit trail); drop them by hand if the feature itself must go. The pool filter added to get_parish_clergy and
-- evaluate_parish_celebrants refers to suspended_at, so the column must stay while those functions are unchanged.

UPDATE auth.users SET banned_until = NULL
WHERE id IN (SELECT id FROM public.profiles WHERE suspended_at IS NOT NULL AND deleted_at IS NULL);

SELECT set_config('app.suspension_ok', '1', false);
UPDATE public.profiles SET suspended_at = NULL, suspended_by = NULL, suspension_reason = NULL WHERE suspended_at IS NOT NULL;
SELECT set_config('app.suspension_ok', '', false);

DROP FUNCTION IF EXISTS public.suspend_user(uuid, text);
DROP FUNCTION IF EXISTS public.reactivate_user(uuid);

CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((SELECT p.deleted_at IS NOT NULL FROM public.profiles p WHERE p.id = _user_id), false);
$$;
