-- ============================================
-- MIGRATION 036: Restrict Parishioner Direct Messaging (Office Gateway Pattern)
-- ============================================
-- Description:
--   Protects parish clergy from unsolicited direct messaging spam by enforcing
--   the Office Gateway pattern:
--   1. Parishioners (role = 'user') can only initiate direct chats with Parish Office
--      staff (role IN ('admin', 'church_admin') and is_priest IS NOT TRUE).
--   2. Direct creation of a chat with a priest by a regular user/parishioner is rejected by RLS.
--   3. Exception: A priest (role = 'priest' or is_priest = true) CAN initiate a direct
--      conversation with a parishioner if the priest is assigned to that parishioner's
--      appointment (EXISTS (SELECT 1 FROM appointments WHERE priest_id = auth.uid() AND user_id = target_user_id)).
-- ============================================

-- Helper functions for safe, non-recursive profile lookups
CREATE OR REPLACE FUNCTION public.get_user_role(target_user_id UUID)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(role, 'user') FROM public.profiles WHERE id = target_user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_user_priest(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user_id
      AND (role = 'priest' OR COALESCE(is_priest, false) = true)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_user_priest(UUID) TO authenticated, anon;

-- 1. Update conversations INSERT Policy
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    (
      type = 'direct'
      AND (created_by IS NULL OR created_by = auth.uid())
    )
    OR (
      type = 'channel'
      AND (
        public.get_current_user_role() = 'super_admin'
        OR (
          public.get_current_user_role() IN ('admin', 'church_admin', 'priest', 'volunteer')
          AND church_id IS NOT NULL
          AND church_id = public.get_current_user_church_id()
        )
      )
    )
  )
);

-- 2. Update conversation_participants INSERT Policy
DROP POLICY IF EXISTS "Authenticated users can join or add participants" ON public.conversation_participants;

CREATE POLICY "Authenticated users can join or add participants"
ON public.conversation_participants FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- Case 1: Parish Staff Channels
    (
      public.get_current_user_role() = 'super_admin'
      OR (
        public.get_current_user_role() IN ('admin', 'church_admin', 'priest', 'volunteer')
        AND EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = conversation_id
            AND c.type = 'channel'
            AND c.church_id = public.get_current_user_church_id()
        )
      )
    )
    OR
    -- Case 2: Direct Conversations (Office Gateway & Priest Privacy Protection)
    (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id AND c.type = 'direct'
      )
      AND (
        -- 2a: Super admin has full participant access
        public.get_current_user_role() = 'super_admin'
        OR
        -- 2b: User is adding themselves to a direct conversation they created
        (
          user_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND c.created_by = auth.uid()
          )
        )
        OR
        -- 2c: Parish office administrators (church_admin, admin) adding participants
        (
          public.get_current_user_role() IN ('admin', 'church_admin')
          AND EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND c.created_by = auth.uid()
          )
        )
        OR
        -- 2d: Regular parishioners/users (role = 'user' or 'volunteer') can ONLY initiate chats
        -- with Parish Office staff (admin, church_admin).
        -- Cold-DMs to priests (role = 'priest' or is_priest = true) are strictly blocked.
        (
          public.get_current_user_role() IN ('user', 'volunteer')
          AND EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND c.created_by = auth.uid()
          )
          AND public.get_user_role(user_id) IN ('super_admin', 'admin', 'church_admin')
          AND NOT public.is_user_priest(user_id)
        )
        OR
        -- 2e: Priests (role = 'priest' or is_priest = true) can initiate direct conversations with:
        -- - other staff members (admin, church_admin, super_admin, or fellow priests)
        -- - a parishioner ONLY IF the priest is assigned to that parishioner's appointment
        (
          public.is_user_priest(auth.uid())
          AND EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND c.created_by = auth.uid()
          )
          AND (
            public.get_user_role(user_id) IN ('admin', 'church_admin', 'super_admin')
            OR public.is_user_priest(user_id)
            OR (
              public.get_user_role(user_id) = 'user'
              AND EXISTS (
                SELECT 1 FROM public.appointments a
                WHERE a.priest_id = auth.uid()
                  AND a.user_id = conversation_participants.user_id
              )
            )
          )
        )
      )
    )
  )
);
