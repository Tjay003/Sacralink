-- Migration 033: Restrict Parish Staff Channels
-- Ensures only parish staff (church_admin, priest, volunteer, super_admin, admin) can access their dedicated church staff channel.

CREATE OR REPLACE FUNCTION public.get_current_user_church_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(assigned_church_id, church_id) FROM public.profiles WHERE id = auth.uid();
$$;

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
);

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    type = 'direct'
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

DROP POLICY IF EXISTS "Authenticated users can join or add participants" ON public.conversation_participants;

CREATE POLICY "Authenticated users can join or add participants"
ON public.conversation_participants FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.type = 'direct'
    )
    OR (
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
  )
);
