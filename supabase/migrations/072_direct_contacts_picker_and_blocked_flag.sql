-- ============================================================================
-- Migration 072: New Message picker list and the blocked-chat list flag (ticket 12)
-- ============================================================================
-- The New Message picker must offer exactly the people the database would let the caller start a Direct
-- chat with (matrix of migration 065), so the browser no longer guesses from roles:
--
--   1. list_direct_contacts(): one row per person may_start_direct(caller, person) accepts.
--      Parishioners and Volunteers get no rows (they open a ticket or use the staff channel).
--   2. other_participant_blocked(conversation): computed column for the conversation list, the twin of
--      is_legacy_direct (065). True when the other member of a Direct chat is deleted or suspended
--      (migration 066), so the composer can say "This user is no longer available".
--
-- Additive and idempotent. Both functions assert an active account like every definer function since 066.
-- ============================================================================

-- 1. Picker list -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_direct_contacts()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  avatar_url text,
  role text,
  is_priest boolean,
  church_id uuid,
  assigned_church_id uuid,
  church_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _role text;
  _church uuid;
BEGIN
  PERFORM public.assert_account_active();

  IF _uid IS NULL THEN
    RETURN;
  END IF;

  _role := public._direct_role(_uid);
  _church := public._direct_church(_uid);

  -- Parishioners and Volunteers never start a Direct chat
  IF _role IS NULL OR _role NOT IN ('priest', 'church_admin', 'super_admin') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id,
         p.full_name::text,
         p.email::text,
         p.avatar_url::text,
         p.role::text,
         COALESCE(p.is_priest, false),
         p.church_id,
         p.assigned_church_id,
         ch.name::text
  FROM public.profiles p
  LEFT JOIN public.churches ch ON ch.id = COALESCE(p.assigned_church_id, p.church_id)
  WHERE p.id <> _uid
    -- Cheap pre-filter so the matrix check below only runs on plausible candidates
    AND (
      p.role::text IN ('super_admin', 'church_admin')
      OR COALESCE(p.assigned_church_id, p.church_id) = _church
      OR EXISTS (SELECT 1 FROM public.appointments a WHERE a.priest_id = _uid AND a.user_id = p.id)
    )
    AND public.may_start_direct(_uid, p.id)
  ORDER BY p.full_name NULLS LAST, p.id
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.list_direct_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_direct_contacts() TO authenticated;

-- 2. Blocked flag for the list ----------------------------------------------

-- Computed column for PostgREST: supabase.from('conversations').select('*, other_participant_blocked')
CREATE OR REPLACE FUNCTION public.other_participant_blocked(c public.conversations)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_account_active();
  RETURN public.direct_other_participant_blocked(c.id);
END;
$$;

REVOKE ALL ON FUNCTION public.other_participant_blocked(public.conversations) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.other_participant_blocked(public.conversations) TO authenticated;

NOTIFY pgrst, 'reload schema';
