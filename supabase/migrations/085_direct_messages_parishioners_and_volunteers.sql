-- ============================================================================
-- Migration 085: Enable Direct Messages for Parishioners and Volunteers
-- ============================================================================
-- Allows:
--   1. Parishioners to direct message other Parishioners and Volunteers (any church)
--   2. Volunteers to direct message other Volunteers and Parishioners (any church)
--
-- Priests, Church Admins, and Super Admins retain their existing matrix rules.
-- Parishioners and Volunteers messaging Priests, Church Admins, or Super Admins
-- continue to be rejected with instructions to raise a ticket or use staff channels.
--
-- Updates:
--   1. _direct_matrix_allows: allows user/volunteer <-> user/volunteer
--   2. start_direct_conversation: refined error messages for user/volunteer
--   3. list_direct_contacts: returns eligible user/volunteer contacts
-- ============================================================================

-- 1. Matrix logic ------------------------------------------------------------

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
    RETURN COALESCE(_tr = 'church_admin' AND _ic = _tc, false);
  ELSIF _ir = 'church_admin' THEN
    IF _tr IN ('super_admin', 'church_admin') THEN
      RETURN true;
    END IF;
    RETURN COALESCE(_tr IN ('user', 'priest', 'volunteer') AND _ic = _tc, false);
  ELSIF _ir = 'super_admin' THEN
    RETURN _tr = 'church_admin';
  ELSIF _ir IN ('user', 'volunteer') THEN
    -- Parishioners and Volunteers can direct message each other and fellow peers (any church)
    RETURN _tr IN ('user', 'volunteer');
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public._direct_matrix_allows(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 2. start_direct_conversation ----------------------------------------------

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
      RAISE EXCEPTION 'Volunteers cannot message priests or admins directly. Use the church staff channel or raise a ticket instead.' USING ERRCODE = '42501';
    ELSIF _ir = 'priest' THEN
      IF _tr = 'super_admin' THEN
        RAISE EXCEPTION 'Raise a platform ticket to reach the Super Admin.' USING ERRCODE = '42501';
      ELSIF _tr IN ('priest', 'volunteer') THEN
        RAISE EXCEPTION 'Use the church staff channel to reach other Priests and Volunteers.' USING ERRCODE = '42501';
      ELSIF _tr = 'user' THEN
        RAISE EXCEPTION 'Priests can only message parishioners who have an appointment with them. Raise a ticket instead.' USING ERRCODE = '42501';
      ELSE
        RAISE EXCEPTION 'Priests can only message the Church Admin of their own church.' USING ERRCODE = '42501';
      END IF;
    ELSIF _ir = 'church_admin' THEN
      RAISE EXCEPTION 'Church Admins can only message people of their own church. Ask that church''s Church Admin instead.' USING ERRCODE = '42501';
    ELSE
      RAISE EXCEPTION 'The Super Admin can only start direct messages with Church Admins. Raise a ticket instead.' USING ERRCODE = '42501';
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

-- 3. Contact picker list -----------------------------------------------------

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
  PERFORM public.assert_account_active();

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
      (_role IN ('user', 'volunteer') AND p.role::text IN ('user', 'volunteer'))
      OR p.role::text IN ('super_admin', 'church_admin')
      OR COALESCE(p.assigned_church_id, p.church_id) = _church
      OR EXISTS (SELECT 1 FROM public.appointments a WHERE a.priest_id = _uid AND a.user_id = p.id)
    )
    AND public.may_start_direct(_uid, p.id)
  ORDER BY p.full_name NULLS LAST, p.id
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.list_direct_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_direct_contacts() TO authenticated;
