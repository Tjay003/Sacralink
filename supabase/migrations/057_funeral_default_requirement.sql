-- ==============================================================================
-- MIGRATION 057: Funeral default checklist and removable checklist documents
-- Ticket 06 (Services & Documents manager in Edit Church).
--
-- 1. The starter template now gives Funeral a required "Death Certificate" (new parishes get it
--    from the web seeder). This migration backfills it ONCE for existing parishes whose live Funeral
--    service (the starter kind 'funeral', whatever it is called now) has no checklist rows at all.
--    A parish that already set its own Funeral checklist, even an optional-only one, is never touched,
--    and a parish that deleted its Funeral service has nothing to backfill. Documents on other
--    services do not count as a Funeral checklist. It is an ordinary editable and deletable document
--    afterwards. Additive: nothing is updated or deleted.
--    The backfill runs only the first time this file is applied (the function does not exist yet), so
--    re-running the file, or APPLY_ALL_MIGRATIONS.sql, never brings back a Death Certificate that a
--    parish removed on purpose.
--
-- 2. appointment_documents.requirement_id referenced sacrament_requirements without an ON DELETE
--    action, so a checklist document that a parishioner had already uploaded a file for could never
--    be deleted by the parish office. It becomes ON DELETE SET NULL: the uploaded file stays on its
--    appointment (the viewers already fall back to a generic "Document" label), only the link to the
--    removed checklist item is cleared. The column is nullable already; no row changes now.
--
-- ASCII only so the file survives any shell encoding when piped into psql.
-- ==============================================================================

BEGIN;

-- Remember whether this is the first application (before the function below exists)
SELECT set_config(
  'app.funeral_default_first_run',
  CASE WHEN to_regprocedure('public.backfill_funeral_death_certificate()') IS NULL THEN 'yes' ELSE 'no' END,
  true
);

-- 1. Checklist documents can be removed even after parishioners uploaded files for them
DO $$
DECLARE
  v_constraint RECORD;
BEGIN
  IF to_regclass('public.appointment_documents') IS NULL THEN
    RETURN;
  END IF;

  FOR v_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.appointment_documents'::regclass
      AND c.confrelid = 'public.sacrament_requirements'::regclass
      AND c.contype = 'f'
      AND c.confdeltype <> 'n'
  LOOP
    EXECUTE format('ALTER TABLE public.appointment_documents DROP CONSTRAINT %I', v_constraint.conname);
    EXECUTE 'ALTER TABLE public.appointment_documents
               ADD CONSTRAINT appointment_documents_requirement_id_fkey
               FOREIGN KEY (requirement_id) REFERENCES public.sacrament_requirements(id) ON DELETE SET NULL';
  END LOOP;
END $$;

-- 2. The Funeral default for parishes that never set a Funeral checklist
CREATE OR REPLACE FUNCTION public.backfill_funeral_death_certificate()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.sacrament_requirements
    (church_id, service_type_id, service_type, requirement_name, is_required, display_order)
  SELECT t.church_id, t.id, lower(t.name), 'Death Certificate', true, 1
  FROM public.church_service_types t
  WHERE t.kind = 'funeral'
    AND t.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.sacrament_requirements r WHERE r.service_type_id = t.id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_funeral_death_certificate() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_funeral_death_certificate() TO service_role;

DO $$
DECLARE
  v_added INTEGER;
BEGIN
  IF current_setting('app.funeral_default_first_run', true) = 'yes' THEN
    v_added := public.backfill_funeral_death_certificate();
    RAISE NOTICE 'Funeral default: Death Certificate added to % parish(es)', v_added;
  ELSE
    RAISE NOTICE 'Funeral default: already applied, nothing to do';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
