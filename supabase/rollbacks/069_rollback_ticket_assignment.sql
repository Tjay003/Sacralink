-- Rollback for migration 069. Restores the 063 cleanup (channels only) and drops the assignment functions.
-- Existing assigned_to values stay as they are.
CREATE OR REPLACE FUNCTION public.cleanup_staff_assignments(p_user_id uuid, p_church_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.conversation_participants cp
    USING public.conversations c
    WHERE cp.conversation_id = c.id
      AND cp.user_id = p_user_id
      AND c.type = 'channel'
      AND c.church_id = p_church_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_staff_assignments(uuid, uuid) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.ticket_assign(uuid, uuid);
DROP FUNCTION IF EXISTS public.ticket_release_handler(uuid, uuid);
