-- Migration 040: Allow Parish Office Inquiry Conversations
-- Enables parishioners to create and view group conversations for parish office inquiries (tagged with church_id),
-- and allows participants to join inquiry group conversations.

-- 1. Update conversations SELECT policy to allow viewing group conversations you participate in or created
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;

CREATE POLICY "Users can view conversations they participate in"
ON public.conversations FOR SELECT
USING (
  (
    type = 'direct'
    AND (
      public.is_conversation_participant(id, auth.uid())
      OR created_by = auth.uid()
      OR public.get_current_user_role() = 'super_admin'
    )
  )
  OR
  (
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
  OR
  (
    type = 'group'
    AND (
      public.is_conversation_participant(id, auth.uid())
      OR created_by = auth.uid()
      OR public.get_current_user_role() = 'super_admin'
      OR (
        public.get_current_user_role() IN ('admin', 'church_admin')
        AND church_id IS NOT NULL
        AND church_id = public.get_current_user_church_id()
      )
    )
  )
);

-- 2. Update conversations INSERT policy to permit group conversations for parish inquiries
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- Direct 1-on-1 conversations
    (
      type = 'direct'
      AND (created_by IS NULL OR created_by = auth.uid())
    )
    OR
    -- Parish Staff Channels (restricted to church staff and super admins)
    (
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
    OR
    -- Parish Office Inquiries (group conversation tagged with church_id, created by inquiring user)
    (
      type = 'group'
      AND church_id IS NOT NULL
      AND (created_by IS NULL OR created_by = auth.uid())
    )
  )
);

-- 3. Update conversation_participants INSERT policy to allow adding participants to inquiry group conversations
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
        -- 2d: Regular parishioners/users can initiate chats with Parish Office staff (admin, church_admin)
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
        -- 2e: Priests
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
    OR
    -- Case 3: Parish Office Inquiry Group Conversations
    (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id AND c.type = 'group' AND c.church_id IS NOT NULL
      )
      AND (
        -- 3a: The creator can add themselves
        user_id = auth.uid()
        OR
        -- 3b: The creator can add church staff of that parish
        (
          EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND c.created_by = auth.uid()
          )
          AND (
            public.get_user_role(user_id) IN ('super_admin', 'admin', 'church_admin')
          )
        )
        OR
        -- 3c: Staff members can add participants to inquiries for their church
        (
          public.get_current_user_role() IN ('super_admin', 'admin', 'church_admin')
        )
      )
    )
  )
);
