-- ============================================
-- MIGRATION 032: Fix Messaging and Profile RLS
-- ============================================
-- Problem 1:
--   conversations SELECT policy requires is_conversation_participant(id, auth.uid()) or super_admin.
--   When inserting a conversation, PostgREST evaluates SELECT RLS on the returning row
--   before the participant row is created. Without created_by = auth.uid(), .single() returns 0 rows (PGRST116).
--
-- Problem 2:
--   profiles SELECT policy only allowed viewing admin/staff profiles, preventing regular users
--   from viewing fellow parishioners/contacts in messaging directory and resolving names.
-- ============================================

-- 1. Update conversations SELECT policy to include created_by = auth.uid()
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;

CREATE POLICY "Users can view conversations they participate in"
ON public.conversations FOR SELECT
USING (
  public.is_conversation_participant(id, auth.uid())
  OR created_by = auth.uid()
  OR (type = 'channel' AND church_id IS NOT NULL AND (church_id = public.get_current_user_church_id() OR public.get_current_user_role() IN ('super_admin', 'admin')))
  OR public.get_current_user_role() = 'super_admin'
);

-- 2. Update profiles SELECT policy so authenticated users can view profiles
DROP POLICY IF EXISTS "Anyone can view admin profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
USING (auth.uid() IS NOT NULL);
