-- ============================================================================
-- Migration 087: Auto-provision Church Staff Channels and Direct Contacts Matrix
-- ============================================================================
-- 1. Auto-provisions and syncs church Staff Channels (type = 'channel') for every
--    church and automatically enrolls all active staff (church_admin, priest, volunteer).
-- 2. Trigger on public.churches automatically provisions the staff channel upon church creation.
-- 3. Trigger on public.profiles automatically syncs staff into the church staff channel
--    whenever a user is assigned a staff role (church_admin, priest, volunteer).
-- 4. Backfills all existing active churches and their staff.
-- 5. Updates _direct_matrix_allows and list_direct_contacts so:
--    - Super Admin can message all staff (church_admin, priest, volunteer) across all churches.
--    - Church staff (church_admin, priest, volunteer) can message all fellow staff of the same church.
-- ============================================================================

-- 1. ensure_church_staff_channel ---------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_church_staff_channel(p_church_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _caller_role text;
  _caller_church uuid;
  _church_name text;
  _conv_id uuid;
BEGIN
  -- 1. Permission check:
  -- Allowed if internal system execution (no auth context or called from a trigger),
  -- OR caller is super_admin,
  -- OR caller is staff (church_admin, priest, volunteer) assigned to p_church_id.
  IF _uid IS NOT NULL AND pg_trigger_depth() = 0 THEN
    SELECT p.role::text, COALESCE(p.assigned_church_id, p.church_id)
    INTO _caller_role, _caller_church
    FROM public.profiles p
    WHERE p.id = _uid;

    IF _caller_role = 'super_admin' THEN
      NULL; -- Allowed
    ELSIF _caller_role IN ('church_admin', 'priest', 'volunteer') AND _caller_church = p_church_id THEN
      NULL; -- Allowed
    ELSE
      RAISE EXCEPTION 'You do not have permission to access the staff channel for this church.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2. Verify Church
  SELECT name INTO _church_name
  FROM public.churches
  WHERE id = p_church_id;

  IF _church_name IS NULL THEN
    RAISE EXCEPTION 'Church not found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Serialize on the church so concurrent requests do not duplicate channel rows
  PERFORM pg_advisory_xact_lock(hashtext('church_staff_channel:' || p_church_id::text));

  -- 4. Find existing channel or create one
  SELECT id INTO _conv_id
  FROM public.conversations
  WHERE type = 'channel' AND church_id = p_church_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF _conv_id IS NULL THEN
    INSERT INTO public.conversations (
      title,
      type,
      church_id,
      created_by
    )
    VALUES (
      _church_name || ' Staff Channel',
      'channel',
      p_church_id,
      _uid
    )
    RETURNING id INTO _conv_id;
  END IF;

  -- 5. Sync all active staff for this church into conversation_participants
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  SELECT _conv_id, p.id
  FROM public.profiles p
  WHERE (p.role::text IN ('church_admin', 'priest', 'volunteer') OR p.is_priest = true)
    AND COALESCE(p.assigned_church_id, p.church_id) = p_church_id
    AND p.deleted_at IS NULL
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  -- If caller is super_admin or an authorized caller, ensure caller is enrolled
  IF _uid IS NOT NULL THEN
    IF _caller_role = 'super_admin' OR _caller_church = p_church_id THEN
      INSERT INTO public.conversation_participants (conversation_id, user_id)
      VALUES (_conv_id, _uid)
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN _conv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_church_staff_channel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_church_staff_channel(uuid) TO authenticated;

-- 2. Triggers for auto-provisioning and staff sync ----------------------------

-- Trigger on public.churches AFTER INSERT
CREATE OR REPLACE FUNCTION public.handle_new_church_staff_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_church_staff_channel(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_churches_ensure_staff_channel ON public.churches;
CREATE TRIGGER trg_churches_ensure_staff_channel
  AFTER INSERT ON public.churches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_church_staff_channel();

-- Trigger on public.profiles AFTER INSERT OR UPDATE
CREATE OR REPLACE FUNCTION public.handle_profile_staff_channel_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target_church uuid;
BEGIN
  IF NEW.role::text IN ('church_admin', 'priest', 'volunteer') OR COALESCE(NEW.is_priest, false) = true THEN
    _target_church := COALESCE(NEW.assigned_church_id, NEW.church_id);
    IF _target_church IS NOT NULL THEN
      PERFORM public.ensure_church_staff_channel(_target_church);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_staff_channel_sync ON public.profiles;
CREATE TRIGGER trg_profiles_staff_channel_sync
  AFTER INSERT OR UPDATE OF role, assigned_church_id, church_id, is_priest ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_staff_channel_sync();

-- 3. Backfill existing churches ----------------------------------------------

DO $$
DECLARE
  ch RECORD;
BEGIN
  FOR ch IN SELECT id FROM public.churches LOOP
    PERFORM public.ensure_church_staff_channel(ch.id);
  END LOOP;
END;
$$;

-- 4. Direct message matrix update --------------------------------------------

CREATE OR REPLACE FUNCTION public._direct_matrix_allows(_initiator uuid, _target uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ir text := public._direct_role(_initiator);
  _tr text := public._direct_role(_target);
  _ic uuid := public._direct_church(_initiator);
  _tc uuid := public._direct_church(_target);
BEGIN
  IF _ir IS NULL OR _tr IS NULL OR _initiator = _target THEN
    RETURN false;
  END IF;

  IF _ir = 'priest' THEN
    IF _tr = 'user' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.priest_id = _initiator AND a.user_id = _target
      );
    END IF;
    -- Priest can message fellow staff of the same church (church_admin, priest, volunteer)
    RETURN COALESCE(_ic = _tc AND _tr IN ('church_admin', 'priest', 'volunteer'), false);
  ELSIF _ir = 'church_admin' THEN
    IF _tr IN ('super_admin', 'church_admin') THEN
      RETURN true;
    END IF;
    -- Church admin can message parishioners and staff of their own church
    RETURN COALESCE(_ic = _tc AND _tr IN ('user', 'priest', 'volunteer'), false);
  ELSIF _ir = 'super_admin' THEN
    -- Super Admin can direct message any church staff member across all churches
    RETURN _tr IN ('church_admin', 'priest', 'volunteer');
  ELSIF _ir = 'volunteer' THEN
    -- Volunteer can message other volunteers and parishioners (any church)
    IF _tr IN ('user', 'volunteer') THEN
      RETURN true;
    END IF;
    -- Volunteer can message fellow staff of their own church (church_admin, priest)
    RETURN COALESCE(_ic = _tc AND _tr IN ('church_admin', 'priest'), false);
  ELSIF _ir = 'user' THEN
    -- Parishioners can direct message other parishioners and volunteers (any church)
    RETURN _tr IN ('user', 'volunteer');
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public._direct_matrix_allows(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 5. start_direct_conversation ----------------------------------------------

CREATE OR REPLACE FUNCTION public.start_direct_conversation(p_target uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ir text;
  _tr text;
  _existing uuid;
  _new uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to start a conversation.' USING ERRCODE = '28000';
  END IF;

  -- Blocked or deleted accounts cannot start anything
  IF to_regprocedure('public.assert_account_active()') IS NOT NULL THEN
    EXECUTE 'SELECT public.assert_account_active()';
  END IF;

  IF p_target IS NULL OR p_target = _uid THEN
    RAISE EXCEPTION 'Choose another person to message.' USING ERRCODE = '22023';
  END IF;

  _ir := public._direct_role(_uid);
  _tr := public._direct_role(p_target);
  IF _ir IS NULL OR _tr IS NULL OR NOT public._direct_account_active(p_target) THEN
    RAISE EXCEPTION 'That person is not available for messages.' USING ERRCODE = '22023';
  END IF;

  -- Two people never get two Direct chats: serialize on the pair, then reuse the existing one
  PERFORM pg_advisory_xact_lock(hashtextextended(least(_uid, p_target)::text || greatest(_uid, p_target)::text, 0));

  SELECT c.id INTO _existing
  FROM public.conversations c
  WHERE c.type = 'direct'
    AND EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = _uid)
    AND EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = p_target)
  ORDER BY c.created_at
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  IF NOT public._direct_matrix_allows(_uid, p_target) THEN
    IF _ir = 'user' THEN
      RAISE EXCEPTION 'Parishioners cannot message staff or admins directly. Raise a ticket instead.' USING ERRCODE = '42501';
    ELSIF _ir = 'volunteer' THEN
      RAISE EXCEPTION 'Volunteers cannot message priests or admins of other churches directly. Use the church staff channel or raise a ticket instead.' USING ERRCODE = '42501';
    ELSIF _ir = 'priest' THEN
      IF _tr = 'super_admin' THEN
        RAISE EXCEPTION 'Raise a platform ticket to reach the Super Admin.' USING ERRCODE = '42501';
      ELSIF _tr IN ('priest', 'volunteer') THEN
        RAISE EXCEPTION 'Priests can only message staff of their own church.' USING ERRCODE = '42501';
      ELSIF _tr = 'user' THEN
        RAISE EXCEPTION 'Priests can only message parishioners who have an appointment with them. Raise a ticket instead.' USING ERRCODE = '42501';
      ELSE
        RAISE EXCEPTION 'Priests can only message staff of their own church.' USING ERRCODE = '42501';
      END IF;
    ELSIF _ir = 'church_admin' THEN
      RAISE EXCEPTION 'Church Admins can only message people of their own church. Ask that church''s Church Admin instead.' USING ERRCODE = '42501';
    ELSE
      RAISE EXCEPTION 'The Super Admin can only start direct messages with church staff. Raise a ticket instead.' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.conversations (type, created_by, title)
  VALUES ('direct', _uid, NULL)
  RETURNING id INTO _new;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (_new, _uid), (_new, p_target);

  RETURN _new;
END;
$$;

REVOKE ALL ON FUNCTION public.start_direct_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_direct_conversation(uuid) TO authenticated;

-- 6. list_direct_contacts ----------------------------------------------------

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
  IF to_regprocedure('public.assert_account_active()') IS NOT NULL THEN
    PERFORM public.assert_account_active();
  END IF;

  IF _uid IS NULL THEN
    RETURN;
  END IF;

  _role := public._direct_role(_uid);
  _church := public._direct_church(_uid);

  IF _role IS NULL THEN
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
    AND (
      -- Super Admin sees all staff (church_admin, priest, volunteer) across all churches
      (_role = 'super_admin' AND (p.role::text IN ('church_admin', 'priest', 'volunteer') OR COALESCE(p.is_priest, false) = true))
      -- Church Admin sees Super Admin, other Church Admins, and anyone in their own church
      OR (_role = 'church_admin' AND (p.role::text IN ('super_admin', 'church_admin') OR COALESCE(p.assigned_church_id, p.church_id) = _church))
      -- Priest sees fellow staff of own church, or parishioners with appointments
      OR (_role = 'priest' AND (
        (COALESCE(p.assigned_church_id, p.church_id) = _church AND (p.role::text IN ('church_admin', 'priest', 'volunteer') OR COALESCE(p.is_priest, false) = true))
        OR EXISTS (SELECT 1 FROM public.appointments a WHERE a.priest_id = _uid AND a.user_id = p.id)
      ))
      -- Volunteer sees fellow staff of own church, plus volunteers and parishioners of any church
      OR (_role = 'volunteer' AND (
        p.role::text IN ('user', 'volunteer')
        OR (COALESCE(p.assigned_church_id, p.church_id) = _church AND (p.role::text IN ('church_admin', 'priest') OR COALESCE(p.is_priest, false) = true))
      ))
      -- Parishioners see other parishioners and volunteers of any church
      OR (_role = 'user' AND p.role::text IN ('user', 'volunteer'))
    )
    AND public.may_start_direct(_uid, p.id)
  ORDER BY p.full_name NULLS LAST, p.id
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.list_direct_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_direct_contacts() TO authenticated;
