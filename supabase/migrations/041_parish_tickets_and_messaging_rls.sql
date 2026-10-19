-- ============================================================================
-- Migration 041: Parish Office Tickets, Messaging RLS & Avatar Integrity
-- ============================================================================

-- 1. Add ticket columns to conversations table
ALTER TABLE public.conversations 
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS ticket_number text;

-- 2. Ensure REPLICA IDENTITY FULL for Realtime updates
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;

-- 3. Update messages SELECT policy:
-- Allow viewing if participant, or super_admin, OR if staff of the conversation's church
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users and staff can view messages" ON public.messages;

CREATE POLICY "Users and staff can view messages"
ON public.messages FOR SELECT
USING (
  public.is_conversation_participant(conversation_id, auth.uid())
  OR public.get_current_user_role() = 'super_admin'
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = conversation_id
      AND c.type IN ('channel', 'group')
      AND c.church_id IS NOT NULL
      AND (
        p.role = 'super_admin'
        OR (
          p.role IN ('admin', 'church_admin', 'priest', 'volunteer')
          AND (p.church_id = c.church_id OR p.assigned_church_id = c.church_id)
        )
      )
  )
);

-- 4. Update messages INSERT policy:
-- Allow sending if participant, or super_admin, OR if staff of the conversation's church
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Participants and staff can send messages" ON public.messages;

CREATE POLICY "Participants and staff can send messages"
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.is_conversation_participant(conversation_id, auth.uid())
    OR public.get_current_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = conversation_id
        AND c.type IN ('channel', 'group')
        AND c.church_id IS NOT NULL
        AND (
          p.role = 'super_admin'
          OR (
            p.role IN ('admin', 'church_admin', 'priest', 'volunteer')
            AND (p.church_id = c.church_id OR p.assigned_church_id = c.church_id)
          )
        )
    )
  )
);

-- 5. Update conversations SELECT policy to include priests and tickets
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users and staff can view conversations" ON public.conversations;

CREATE POLICY "Users and staff can view conversations"
ON public.conversations FOR SELECT
USING (
  public.is_conversation_participant(id, auth.uid())
  OR created_by = auth.uid()
  OR public.get_current_user_role() = 'super_admin'
  OR (
    type IN ('channel', 'group')
    AND church_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'super_admin'
          OR (
            p.role IN ('admin', 'church_admin', 'priest', 'volunteer')
            AND (p.church_id = conversations.church_id OR p.assigned_church_id = conversations.church_id)
          )
        )
    )
  )
);

-- 6. Fix Security Hole in conversation_participants INSERT (ensure creator can only add self)
DROP POLICY IF EXISTS "Users and staff can join conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users and staff can join conversations securely" ON public.conversation_participants;

CREATE POLICY "Users and staff can join conversations securely"
ON public.conversation_participants FOR INSERT
WITH CHECK (
  -- Super admin can add anyone
  public.get_current_user_role() = 'super_admin'
  -- 1: Direct conversations: creator can add themselves and recipient
  OR (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.type = 'direct'
        AND (c.created_by = auth.uid() OR public.is_conversation_participant(conversation_id, auth.uid()))
    )
  )
  -- 2: Church staff channels: staff of that church can join
  OR (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = conversation_id AND c.type = 'channel'
        AND (p.role IN ('admin', 'church_admin', 'priest', 'volunteer') AND (p.church_id = c.church_id OR p.assigned_church_id = c.church_id))
    )
  )
  -- 3: Parish office inquiries / group tickets:
  OR (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.type = 'group' AND c.church_id IS NOT NULL
        AND (
          -- 3a: Only the genuine creator can add themselves or staff at creation time
          (c.created_by = auth.uid())
          -- 3b: Assigned staff/priests of that church can join/participate
          OR (
            user_id = auth.uid()
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid()
                AND p.role IN ('admin', 'church_admin', 'priest', 'volunteer')
                AND (p.church_id = c.church_id OR p.assigned_church_id = c.church_id)
            )
          )
        )
    )
  )
);

-- 7. Allow staff to update status/category on conversations
DROP POLICY IF EXISTS "Staff can update ticket status" ON public.conversations;
CREATE POLICY "Staff can update ticket status"
ON public.conversations FOR UPDATE
USING (
  public.get_current_user_role() = 'super_admin'
  OR created_by = auth.uid()
  OR (
    church_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'church_admin', 'priest', 'volunteer')
        AND (p.church_id = conversations.church_id OR p.assigned_church_id = conversations.church_id)
    )
  )
)
WITH CHECK (
  public.get_current_user_role() = 'super_admin'
  OR created_by = auth.uid()
  OR (
    church_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'church_admin', 'priest', 'volunteer')
        AND (p.church_id = conversations.church_id OR p.assigned_church_id = conversations.church_id)
    )
  )
);
