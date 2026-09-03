-- ============================================
-- MIGRATION 029: Protect Parish Staff Channels from Deletion
-- ============================================
-- Description:
--   Restricts DELETE policy on public.conversations to type = 'direct' only.
--   Parish staff channels (type = 'channel') are official diocese/parish staff rooms
--   and must never be deleted by anyone.
-- ============================================

DROP POLICY IF EXISTS "Participants and admins can delete conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants and admins can delete direct conversations" ON public.conversations;

CREATE POLICY "Participants and admins can delete direct conversations"
ON public.conversations FOR DELETE
USING (
  type = 'direct'
  AND (
    public.is_conversation_participant(id, auth.uid())
    OR created_by = auth.uid()
    OR public.get_current_user_role() = 'super_admin'
  )
);
