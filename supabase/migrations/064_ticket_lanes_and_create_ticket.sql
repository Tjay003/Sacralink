-- =========================================================
-- MIGRATION 064: Ticket data model, lanes and create_ticket()
-- =========================================================
-- A ticket is a conversations row (type = 'group', ticket_number IS NOT NULL). This migration:
--   1. adds the DB-owned ticket columns (lane, assignment, escalation, reopen, follow-up link),
--   2. generates ticket numbers from a sequence,
--   3. adds create_ticket(), the only way to create a ticket (limits, categories and participants are decided here),
--   4. blocks creating or re-labelling tickets through plain REST,
--   5. keeps a platform-lane ticket readable by its requester and the Super Admin only.
-- Additive and idempotent. Ticket 07 adds assert_account_active() to the new functions in its sweep.

-- 1. Ticket columns --------------------------------------------------------------------------------
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ticket_lane text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopen_count smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS linked_ticket_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_back_at timestamptz;

-- Every ticket that exists today is a church-lane ticket
UPDATE public.conversations
SET ticket_lane = 'church'
WHERE ticket_number IS NOT NULL AND ticket_lane IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_ticket_lane_check') THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_ticket_lane_check CHECK (ticket_lane IS NULL OR ticket_lane IN ('church', 'platform'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_ticket_has_lane_check') THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_ticket_has_lane_check CHECK (ticket_number IS NULL OR ticket_lane IS NOT NULL);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON public.conversations(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_ticket_requester
  ON public.conversations(created_by, ticket_lane, status) WHERE ticket_number IS NOT NULL;

-- 2. Ticket numbers --------------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.ticket_number_seq;

-- Next free number; skips any value an older, browser-generated ticket already holds
CREATE OR REPLACE FUNCTION public.next_ticket_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_number text;
BEGIN
  LOOP
    v_number := 'TCK-' || lpad(nextval('public.ticket_number_seq')::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.conversations WHERE ticket_number = v_number);
  END LOOP;
  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION public.next_ticket_number() FROM PUBLIC;

-- The old browser-side numbers were collision-prone: renumber later duplicates so the unique index can exist
UPDATE public.conversations c
SET ticket_number = public.next_ticket_number()
FROM (
  SELECT id, row_number() OVER (PARTITION BY ticket_number ORDER BY created_at, id) AS rn
  FROM public.conversations
  WHERE ticket_number IS NOT NULL
) d
WHERE c.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_ticket_number_key
  ON public.conversations(ticket_number) WHERE ticket_number IS NOT NULL;

-- 3. Helpers ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.church_has_admin(_church_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.role = 'church_admin'
      AND (p.church_id = _church_id OR p.assigned_church_id = _church_id)
  );
$$;

REVOKE ALL ON FUNCTION public.church_has_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.church_has_admin(uuid) TO authenticated;

-- Replaced by ticket 17 when the Request-user-deletion ticket ships
CREATE OR REPLACE FUNCTION public.ticket_deletion_requests_enabled()
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$ SELECT false; $$;

REVOKE ALL ON FUNCTION public.ticket_deletion_requests_enabled() FROM PUBLIC;

-- 4. create_ticket ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_ticket(
  p_lane text,
  p_church_id uuid,
  p_category text,
  p_subject text,
  p_message text,
  p_linked_ticket_id uuid DEFAULT NULL,
  p_subject_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_home_church uuid;
  v_assigned_church uuid;
  v_subject text := btrim(COALESCE(p_subject, ''));
  v_message text := btrim(COALESCE(p_message, ''));
  v_church_categories text[] := ARRAY['baptism', 'wedding', 'funeral', 'mass_intention', 'certificate', 'general'];
  v_allowed text[];
  v_super_admin uuid;
  v_open_count integer;
  v_ticket_number text;
  v_conversation_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create a ticket.';
  END IF;

  SELECT p.role::text, p.church_id, p.assigned_church_id
    INTO v_role, v_home_church, v_assigned_church
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;
  IF v_role = 'super_admin' THEN
    RAISE EXCEPTION 'The Super Admin cannot create tickets.';
  END IF;
  IF v_role NOT IN ('user', 'volunteer', 'church_admin', 'priest') THEN
    RAISE EXCEPTION 'Your role cannot create tickets.';
  END IF;
  IF p_lane IS NULL OR p_lane NOT IN ('church', 'platform') THEN
    RAISE EXCEPTION 'Unknown ticket lane.';
  END IF;
  IF length(v_subject) < 3 THEN
    RAISE EXCEPTION 'Subject must be at least 3 characters long.';
  END IF;
  IF length(v_message) < 10 THEN
    RAISE EXCEPTION 'Message must be at least 10 characters long.';
  END IF;
  IF p_church_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.churches WHERE id = p_church_id) THEN
    RAISE EXCEPTION 'Church not found.';
  END IF;
  IF p_category IS NULL THEN
    RAISE EXCEPTION 'Choose a category.';
  END IF;

  -- One request per caller at a time, so two simultaneous requests cannot both slip past a limit
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text));

  IF p_linked_ticket_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_linked_ticket_id AND c.ticket_number IS NOT NULL AND c.created_by = v_uid
  ) THEN
    RAISE EXCEPTION 'The ticket you are following up on was not found.';
  END IF;
  IF p_subject_user_id IS NOT NULL AND p_category <> 'user_deletion_request' THEN
    RAISE EXCEPTION 'A subject user is only allowed on a user deletion request.';
  END IF;

  IF p_lane = 'church' THEN
    -- Parish office: Parishioners and Volunteers only
    IF v_role NOT IN ('user', 'volunteer') THEN
      RAISE EXCEPTION 'Church staff contact the Super Admin through a platform ticket.';
    END IF;
    IF NOT (p_category = ANY (v_church_categories)) THEN
      RAISE EXCEPTION 'That category is not available for the parish office.';
    END IF;
    IF NOT public.church_has_admin(p_church_id) THEN
      RAISE EXCEPTION 'This church has no administrator yet. You can report a concern about the church instead.';
    END IF;
  ELSE
    -- Platform lane: straight to the Super Admin
    SELECT p.id INTO v_super_admin FROM public.profiles p WHERE p.role = 'super_admin' ORDER BY p.created_at LIMIT 1;
    IF v_super_admin IS NULL THEN
      RAISE EXCEPTION 'There is no Super Admin to receive this ticket.';
    END IF;

    IF v_role = 'user' THEN
      v_allowed := ARRAY['report_church'];
    ELSE
      IF p_church_id IS DISTINCT FROM v_home_church AND p_church_id IS DISTINCT FROM v_assigned_church THEN
        RAISE EXCEPTION 'A platform ticket from church staff must be about your own church.';
      END IF;
      IF v_role = 'church_admin' THEN
        v_allowed := ARRAY['general', 'user_deletion_request', 'church_setup', 'report_problem', 'report_person'];
      ELSE
        v_allowed := ARRAY['general', 'report_problem', 'report_person'];
      END IF;
    END IF;

    IF NOT (p_category = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'That category is not available for your role.';
    END IF;
    IF p_category = 'user_deletion_request' AND NOT public.ticket_deletion_requests_enabled() THEN
      RAISE EXCEPTION 'User deletion requests are not available yet.';
    END IF;

    -- Rate limits count only tickets that are still open or in progress
    IF p_category = 'user_deletion_request' THEN
      SELECT count(*) INTO v_open_count FROM public.conversations c
      WHERE c.created_by = v_uid AND c.ticket_lane = 'platform' AND c.category = 'user_deletion_request'
        AND c.status IN ('open', 'in_progress');
      IF v_open_count >= 5 THEN
        RAISE EXCEPTION 'You already have 5 open deletion requests. Wait for the Super Admin to decide on one before filing another.';
      END IF;
    ELSIF p_category = 'report_church' THEN
      SELECT count(*) INTO v_open_count FROM public.conversations c
      WHERE c.created_by = v_uid AND c.ticket_lane = 'platform' AND c.category = 'report_church'
        AND c.status IN ('open', 'in_progress');
      IF v_open_count >= 2 THEN
        RAISE EXCEPTION 'You already have 2 open concerns. Wait for a reply before raising another.';
      END IF;
    ELSE
      SELECT count(*) INTO v_open_count FROM public.conversations c
      WHERE c.created_by = v_uid AND c.ticket_lane = 'platform' AND c.category <> 'user_deletion_request'
        AND c.status IN ('open', 'in_progress');
      IF v_open_count >= 3 THEN
        RAISE EXCEPTION 'You already have 3 open tickets with the Super Admin. Wait for a reply or close one before raising another.';
      END IF;
    END IF;
  END IF;

  v_ticket_number := public.next_ticket_number();

  INSERT INTO public.conversations (title, type, church_id, created_by, category, status, ticket_number, ticket_lane, linked_ticket_id)
  VALUES ('Inquiry: ' || v_subject, 'group', p_church_id, v_uid, p_category, 'open', v_ticket_number, p_lane, p_linked_ticket_id)
  RETURNING id INTO v_conversation_id;

  -- Participants: the requester plus the Church Admins (church lane) or the Super Admin (platform lane)
  INSERT INTO public.conversation_participants (conversation_id, user_id, last_read_at)
  VALUES (v_conversation_id, v_uid, now());

  IF p_lane = 'church' THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    SELECT v_conversation_id, p.id
    FROM public.profiles p
    WHERE p.role = 'church_admin'
      AND (p.church_id = p_church_id OR p.assigned_church_id = p_church_id)
      AND p.id <> v_uid
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (v_conversation_id, v_super_admin)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content, message_type, metadata)
  VALUES (
    v_conversation_id,
    v_uid,
    '[Inquiry: ' || v_subject || E']\n\n' || v_message,
    'text',
    jsonb_strip_nulls(jsonb_build_object(
      'inquiry_subject', v_subject,
      'church_id', p_church_id,
      'category', p_category,
      'ticket_number', v_ticket_number,
      'ticket_lane', p_lane,
      'subject_user_id', p_subject_user_id
    ))
  );

  RETURN v_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_ticket(text, uuid, text, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ticket(text, uuid, text, text, text, uuid, uuid) TO authenticated;

-- 5. Tickets can no longer be created or re-labelled by REST --------------------------------------
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND ticket_number IS NULL
  AND ticket_lane IS NULL
  AND (
    (type = 'direct' AND (created_by IS NULL OR created_by = auth.uid()))
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
    OR (type = 'group' AND church_id IS NOT NULL AND (created_by IS NULL OR created_by = auth.uid()))
  )
);

-- A direct UPDATE must not turn a chat into a ticket or change a ticket's number or lane
CREATE OR REPLACE FUNCTION public.guard_ticket_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Trusted writers (service role, SQL editor) that still insert a bare ticket get the church lane, like every ticket before this migration
  IF TG_OP = 'INSERT' AND NEW.ticket_number IS NOT NULL AND NEW.ticket_lane IS NULL
     AND current_user NOT IN ('authenticated', 'anon') THEN
    NEW.ticket_lane := 'church';
  END IF;
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' AND (NEW.ticket_number IS NOT NULL OR NEW.ticket_lane IS NOT NULL) THEN
      RAISE EXCEPTION 'Tickets are created with create_ticket().';
    END IF;
    IF TG_OP = 'UPDATE' AND (
      NEW.ticket_number IS DISTINCT FROM OLD.ticket_number
      OR NEW.ticket_lane IS DISTINCT FROM OLD.ticket_lane
    ) THEN
      RAISE EXCEPTION 'A ticket number or lane cannot be changed.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ticket_identity ON public.conversations;
CREATE TRIGGER trg_guard_ticket_identity
  BEFORE INSERT OR UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.guard_ticket_identity();

-- 6. Read rule: a platform-lane ticket is visible to its participants and the Super Admin only ------
-- Same as migration 059 except for the platform branch. Ticket 11 later replaces the whole predicate.
CREATE OR REPLACE FUNCTION public.can_access_conversation(
  _conversation_id uuid,
  _type text,
  _church_id uuid,
  _ticket_number text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _role text;
  _church_match boolean;
  _participant boolean;
  _lane text;
BEGIN
  IF _uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.role::text,
         COALESCE(p.church_id = _church_id OR p.assigned_church_id = _church_id, false)
    INTO _role, _church_match
  FROM public.profiles p
  WHERE p.id = _uid;

  _participant := EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = _conversation_id AND cp.user_id = _uid
  );

  IF _type = 'channel' THEN
    RETURN COALESCE(
      _role IN ('super_admin', 'admin')
      OR (_role IN ('church_admin', 'priest', 'volunteer') AND (_participant OR _church_match)),
      false
    );
  ELSIF _type = 'group' AND _ticket_number IS NOT NULL THEN
    SELECT c.ticket_lane INTO _lane FROM public.conversations c WHERE c.id = _conversation_id;
    IF _lane = 'platform' THEN
      RETURN COALESCE(_participant OR _role = 'super_admin', false);
    END IF;
    RETURN COALESCE(
      _participant
      OR _role IN ('super_admin', 'admin')
      OR (_role IN ('church_admin', 'volunteer') AND _church_match),
      false
    );
  ELSIF _type = 'group' THEN
    RETURN COALESCE(
      _participant
      OR _role IN ('super_admin', 'admin')
      OR (_role IN ('church_admin', 'priest', 'volunteer') AND _church_match),
      false
    );
  END IF;

  RETURN _participant;
END;
$$;
