-- ============================================
-- MIGRATION 028: Add Conversation Deletion and Realtime Enhancements
-- ============================================
-- Description:
--   Adds RLS policy allowing conversation participants and admins to delete
--   conversations ("Delete for Everyone"), and confirms delete policy for
--   conversation participants ("Delete for Me").
-- ============================================

-- 1. Conversations Delete Policy
DROP POLICY IF EXISTS "Participants and admins can delete conversations" ON public.conversations;
CREATE POLICY "Participants and admins can delete conversations"
ON public.conversations FOR DELETE
USING (
  public.is_conversation_participant(id, auth.uid())
  OR created_by = auth.uid()
  OR public.get_current_user_role() = 'super_admin'
);

-- 2. Conversation Participants Delete Policy (for "Delete for Me")
DROP POLICY IF EXISTS "Users can leave conversations" ON public.conversation_participants;
CREATE POLICY "Users can leave conversations"
ON public.conversation_participants FOR DELETE
USING (
  user_id = auth.uid()
  OR public.get_current_user_role() = 'super_admin'
);
