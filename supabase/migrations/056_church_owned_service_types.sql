-- ==============================================================================
-- MIGRATION 056: Church-owned service types
-- Each parish owns the list of services it offers. The six built-ins (Baptism, Wedding,
-- Funeral, Confirmation, Blessing, Other) are only the starter template: every existing
-- parish is backfilled with them and every new parish is seeded with them, after which a
-- parish can rename, hide, delete or add services freely.
--
-- 1. church_service_types: name, optional description, display order, hidden flag,
--    soft-delete stamp and a stable "kind" (the starter key that survives a rename, used
--    for behaviour such as the Funeral burial fields). Names are unique per parish,
--    case-insensitive, among non-deleted rows.
-- 2. appointments.service_type_id and sacrament_requirements.service_type_id link rows to
--    a service by id. The legacy text columns STAY and are kept in step with the service
--    name (appointments: the name; requirements: the lowercased name, the established
--    convention), so mobile, notification SQL and dashboards that read text keep working.
--    The 6-value CHECK on appointments.service_type is dropped.
-- 3. A BEFORE INSERT trigger on both tables fills service_type_id from
--    (church_id, lower(service_type)) when it is null, so old clients (the live web build,
--    the mobile app) that insert by text only still produce linked rows. Text that matches no
--    service of the parish creates one (hidden, so a parish that renamed or dropped a service
--    is not forced to offer it again) instead of failing the booking.
-- 4. Renaming a service updates the mirrored text columns in the same transaction.
-- 5. RLS: reads are public (booking needs them); only that parish's church_admin, plus admin
--    and super_admin, can insert or update. There is no DELETE policy: removal goes through
--    delete_church_service_type(), which soft-deletes when the service has appointments and
--    physically removes it (with its checklist) when it has none. The same staff may also
--    write the parish checklist (sacrament_requirements), which ticket 06 builds a UI on.
-- 6. Backfill (idempotent, additive, atomic): backfill_church_service_types() seeds the six
--    for parishes that have no services yet, then links every unlinked appointment and
--    requirement by lowercased text, creating a hidden service for text that matches nothing.
--    No existing text value is ever rewritten and no row is deleted. The migration fails as a
--    whole when a row is lost or left unlinked.
--
-- sacrament_requirements.service_type was the sacrament_type enum on databases built from
-- the first schema (it cannot hold custom names); it is converted to text, a no-op where it is
-- already text. ASCII only so the file survives any shell encoding when piped into psql.
-- ==============================================================================

BEGIN;

-- 0. Legacy service_type columns must be able to hold any service name
DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['appointments', 'sacrament_requirements'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_table
        AND column_name = 'service_type' AND data_type <> 'text'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN service_type TYPE TEXT USING service_type::text', v_table);
    END IF;
  END LOOP;
END $$;

-- 1. Drop the 6-value CHECK on appointments.service_type (whatever it is named)
DO $$
DECLARE
  v_constraint RECORD;
BEGIN
  FOR v_constraint IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%service_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.appointments DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;
END $$;

-- 2. The services a parish offers
CREATE TABLE IF NOT EXISTS public.church_service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  description TEXT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ NULL,
  kind TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_church_service_types_name
  ON public.church_service_types (church_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_church_service_types_church_order
  ON public.church_service_types (church_id, display_order);

-- Trim names, turn a blank description into NULL, and never let a service change parish
CREATE OR REPLACE FUNCTION public.normalize_church_service_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.name := btrim(COALESCE(NEW.name, ''));
  NEW.description := NULLIF(btrim(COALESCE(NEW.description, '')), '');
  IF TG_OP = 'UPDATE' AND NEW.church_id IS DISTINCT FROM OLD.church_id THEN
    RAISE EXCEPTION 'A service cannot move to another parish' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_church_service_type ON public.church_service_types;
CREATE TRIGGER trg_normalize_church_service_type
  BEFORE INSERT OR UPDATE ON public.church_service_types
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_church_service_type();

-- 3. The links
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_type_id UUID NULL REFERENCES public.church_service_types(id) ON DELETE SET NULL;

ALTER TABLE public.sacrament_requirements
  ADD COLUMN IF NOT EXISTS service_type_id UUID NULL REFERENCES public.church_service_types(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_appointments_service_type_id
  ON public.appointments (service_type_id)
  WHERE service_type_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sacrament_requirements_service_type_id
  ON public.sacrament_requirements (service_type_id)
  WHERE service_type_id IS NOT NULL;

-- 4. Who may manage a parish's services (and checklist): that parish's church_admin, plus admin and
--    super_admin (system-wide roles; the web "Add church" page is theirs too)
CREATE OR REPLACE FUNCTION public.can_manage_church_services(p_church_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_church_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND (
        pr.role::text IN ('super_admin', 'admin')
        OR (pr.role::text = 'church_admin'
            AND COALESCE(pr.assigned_church_id, pr.church_id) = p_church_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_church_services(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_church_services(UUID) TO authenticated, service_role;

-- 5. RLS
ALTER TABLE public.church_service_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service types are viewable by everyone" ON public.church_service_types;
CREATE POLICY "Service types are viewable by everyone"
  ON public.church_service_types FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Parish staff can add service types" ON public.church_service_types;
CREATE POLICY "Parish staff can add service types"
  ON public.church_service_types FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_church_services(church_id));

DROP POLICY IF EXISTS "Parish staff can edit service types" ON public.church_service_types;
CREATE POLICY "Parish staff can edit service types"
  ON public.church_service_types FOR UPDATE
  TO authenticated
  USING (public.can_manage_church_services(church_id))
  WITH CHECK (public.can_manage_church_services(church_id));

REVOKE ALL ON TABLE public.church_service_types FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.church_service_types TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.church_service_types TO authenticated;
GRANT ALL ON TABLE public.church_service_types TO service_role;

-- The parish's own staff may write its checklist (the Services and Documents manager).
-- Older policies on sacrament_requirements stay; permissive policies add up.
DROP POLICY IF EXISTS "Parish staff can manage their checklist" ON public.sacrament_requirements;
CREATE POLICY "Parish staff can manage their checklist"
  ON public.sacrament_requirements FOR ALL
  TO authenticated
  USING (public.can_manage_church_services(church_id))
  WITH CHECK (public.can_manage_church_services(church_id));

-- 6. Find the service of a parish for a piece of text, creating a hidden one when none exists.
--    A live service wins over a deleted one; text that only matches a deleted service links to it
--    so a deleted service is never brought back by an old client.
CREATE OR REPLACE FUNCTION public.resolve_service_type_id(p_church_id UUID, p_text TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text TEXT := btrim(COALESCE(p_text, ''));
  v_id UUID;
BEGIN
  IF p_church_id IS NULL OR v_text = '' THEN
    RETURN NULL;
  END IF;

  SELECT t.id INTO v_id
  FROM public.church_service_types t
  WHERE t.church_id = p_church_id AND lower(t.name) = lower(v_text)
  ORDER BY (t.deleted_at IS NULL) DESC, t.created_at DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.church_service_types (church_id, name, display_order, is_hidden)
  VALUES (
    p_church_id,
    v_text,
    COALESCE((SELECT max(t.display_order) FROM public.church_service_types t WHERE t.church_id = p_church_id), 0) + 1,
    true
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT t.id INTO v_id
    FROM public.church_service_types t
    WHERE t.church_id = p_church_id AND lower(t.name) = lower(v_text) AND t.deleted_at IS NULL
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_service_type_id(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- 7. Link trigger. On INSERT it fills service_type_id from the text when absent and then keeps the
--    text equal to the service name. On UPDATE of the link it only checks that the service belongs
--    to the row's parish (the backfill relies on that: it never rewrites existing text).
CREATE OR REPLACE FUNCTION public.link_service_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type public.church_service_types%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.service_type_id IS NULL THEN
    NEW.service_type_id := public.resolve_service_type_id(NEW.church_id, NEW.service_type);
  END IF;

  IF NEW.service_type_id IS NOT NULL THEN
    SELECT * INTO v_type FROM public.church_service_types WHERE id = NEW.service_type_id;
    IF NOT FOUND OR v_type.church_id IS DISTINCT FROM NEW.church_id THEN
      RAISE EXCEPTION 'The service does not belong to this parish' USING ERRCODE = '22023';
    END IF;

    IF TG_OP = 'INSERT' THEN
      IF TG_TABLE_NAME = 'sacrament_requirements' THEN
        NEW.service_type := lower(v_type.name);
      ELSE
        NEW.service_type := v_type.name;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.link_service_type() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_link_service_type ON public.appointments;
CREATE TRIGGER trg_link_service_type
  BEFORE INSERT OR UPDATE OF service_type_id, church_id ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.link_service_type();

DROP TRIGGER IF EXISTS trg_link_service_type ON public.sacrament_requirements;
CREATE TRIGGER trg_link_service_type
  BEFORE INSERT OR UPDATE OF service_type_id, church_id ON public.sacrament_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.link_service_type();

-- 8. A rename follows everywhere, including past appointments, in the same transaction.
--    Notifications already sent keep their old wording.
CREATE OR REPLACE FUNCTION public.sync_service_type_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.appointments
  SET service_type = NEW.name
  WHERE service_type_id = NEW.id AND service_type IS DISTINCT FROM NEW.name;

  UPDATE public.sacrament_requirements
  SET service_type = lower(NEW.name)
  WHERE service_type_id = NEW.id AND service_type IS DISTINCT FROM lower(NEW.name);

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_service_type_name() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_service_type_name ON public.church_service_types;
CREATE TRIGGER trg_sync_service_type_name
  AFTER UPDATE OF name ON public.church_service_types
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION public.sync_service_type_name();

-- 9. The starter template. A starter that the parish already has (by kind or by name, deleted or
--    not) is never added again, so re-seeding never undoes a rename or a deletion.
CREATE OR REPLACE FUNCTION public.insert_starter_service_types(p_church_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.church_service_types (church_id, name, kind, display_order)
  SELECT p_church_id, s.name, s.kind, s.ord
  FROM (VALUES
    ('Baptism', 'baptism', 1),
    ('Wedding', 'wedding', 2),
    ('Funeral', 'funeral', 3),
    ('Confirmation', 'confirmation', 4),
    ('Blessing', 'blessing', 5),
    ('Other', 'other', 6)
  ) AS s(name, kind, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.church_service_types t
    WHERE t.church_id = p_church_id
      AND (t.kind = s.kind OR lower(t.name) = lower(s.name))
  )
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_starter_service_types(UUID) FROM PUBLIC, anon, authenticated;

-- Called by the web seeders for a new parish (and by the e2e setup with the service role)
CREATE OR REPLACE FUNCTION public.seed_church_service_types(p_church_id UUID)
RETURNS SETOF public.church_service_types
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.can_manage_church_services(p_church_id)) THEN
    RAISE EXCEPTION 'Only the parish office can set up its services' USING ERRCODE = '42501';
  END IF;

  PERFORM public.insert_starter_service_types(p_church_id);

  RETURN QUERY
  SELECT t.* FROM public.church_service_types t
  WHERE t.church_id = p_church_id AND t.deleted_at IS NULL
  ORDER BY t.display_order, t.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_church_service_types(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_church_service_types(UUID) TO authenticated, service_role;

-- 10. Delete: soft-delete when appointments use the service, physical delete (checklist cascades) when not
CREATE OR REPLACE FUNCTION public.delete_church_service_type(p_service_type_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type public.church_service_types%ROWTYPE;
BEGIN
  SELECT * INTO v_type
  FROM public.church_service_types
  WHERE id = p_service_type_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (auth.role() = 'service_role' OR public.can_manage_church_services(v_type.church_id)) THEN
    RAISE EXCEPTION 'Only the parish office can delete its services' USING ERRCODE = '42501';
  END IF;

  IF v_type.deleted_at IS NOT NULL THEN
    RETURN 'archived';
  END IF;

  IF EXISTS (SELECT 1 FROM public.appointments a WHERE a.service_type_id = v_type.id) THEN
    UPDATE public.church_service_types SET deleted_at = NOW() WHERE id = v_type.id;
    RETURN 'archived';
  END IF;

  DELETE FROM public.church_service_types WHERE id = v_type.id;
  RETURN 'deleted';
END;
$$;

REVOKE ALL ON FUNCTION public.delete_church_service_type(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_church_service_type(UUID) TO authenticated, service_role;

-- 11. Backfill. Safe to run any number of times; it only adds services and links.
CREATE OR REPLACE FUNCTION public.backfill_church_service_types()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church UUID;
  v_seeded INTEGER := 0;
  v_types_before BIGINT;
  v_types_after BIGINT;
  v_appointments INTEGER;
  v_requirements INTEGER;
BEGIN
  FOR v_church IN
    SELECT c.id FROM public.churches c
    WHERE NOT EXISTS (SELECT 1 FROM public.church_service_types t WHERE t.church_id = c.id)
  LOOP
    PERFORM public.insert_starter_service_types(v_church);
    v_seeded := v_seeded + 1;
  END LOOP;

  SELECT count(*) INTO v_types_before FROM public.church_service_types;

  UPDATE public.appointments a
  SET service_type_id = public.resolve_service_type_id(a.church_id, a.service_type)
  WHERE a.service_type_id IS NULL AND btrim(COALESCE(a.service_type, '')) <> '';
  GET DIAGNOSTICS v_appointments = ROW_COUNT;

  UPDATE public.sacrament_requirements r
  SET service_type_id = public.resolve_service_type_id(r.church_id, r.service_type)
  WHERE r.service_type_id IS NULL AND btrim(COALESCE(r.service_type, '')) <> '';
  GET DIAGNOSTICS v_requirements = ROW_COUNT;

  SELECT count(*) INTO v_types_after FROM public.church_service_types;

  RETURN jsonb_build_object(
    'churches_seeded', v_seeded,
    'types_created_from_text', v_types_after - v_types_before,
    'appointments_linked', v_appointments,
    'requirements_linked', v_requirements
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_church_service_types() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_church_service_types() TO service_role;

-- 12. Run the backfill now and fail the whole migration if a row was lost or left unlinked
DO $$
DECLARE
  v_appointments_before BIGINT;
  v_requirements_before BIGINT;
  v_result JSONB;
  v_unlinked BIGINT;
BEGIN
  SELECT count(*) INTO v_appointments_before FROM public.appointments;
  SELECT count(*) INTO v_requirements_before FROM public.sacrament_requirements;

  v_result := public.backfill_church_service_types();

  IF (SELECT count(*) FROM public.appointments) <> v_appointments_before
     OR (SELECT count(*) FROM public.sacrament_requirements) <> v_requirements_before THEN
    RAISE EXCEPTION 'Service type backfill changed the number of appointments or requirements';
  END IF;

  SELECT
    (SELECT count(*) FROM public.appointments
       WHERE service_type_id IS NULL AND btrim(COALESCE(service_type, '')) <> '')
    + (SELECT count(*) FROM public.sacrament_requirements
       WHERE service_type_id IS NULL AND btrim(COALESCE(service_type, '')) <> '')
  INTO v_unlinked;

  IF v_unlinked > 0 THEN
    RAISE EXCEPTION 'Service type backfill left % rows unlinked', v_unlinked;
  END IF;

  RAISE NOTICE 'Service type backfill: %', v_result;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
