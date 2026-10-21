-- ==============================================================================
-- VERIFY migration 057 (Funeral default checklist): read-only
-- Run on the database AFTER applying 057. Nothing here writes. Part 1 is one result set: every row
-- with expected_value filled must show ok = true. Part 2 lists details for a human to read.
--
-- Compare requirements_total with 057_funeral_default_before.sql: it must equal
-- requirements_total_before + parishes_that_will_get_the_death_certificate, and
-- appointment_documents_total must be identical. Check 2 must be 0 when you run this right after applying;
-- later it can legitimately rise if a parish deletes the Death Certificate (the backfill never runs twice).
-- ==============================================================================

-- PART 1: checks
WITH funeral AS (
  SELECT t.id, t.church_id
  FROM public.church_service_types t
  WHERE t.kind = 'funeral' AND t.deleted_at IS NULL
),
checks AS (
  SELECT 1 AS ord, 'live_funeral_services' AS check_name,
         (SELECT count(*) FROM funeral)::bigint AS actual_value,
         NULL::bigint AS expected_value
  UNION ALL SELECT 2, 'funeral_services_with_no_checklist_row_left',
         (SELECT count(*) FROM funeral f
            WHERE NOT EXISTS (SELECT 1 FROM public.sacrament_requirements r WHERE r.service_type_id = f.id))::bigint,
         0
  UNION ALL SELECT 3, 'funeral_services_whose_only_documents_are_not_required (a parish own choice, informational)',
         (SELECT count(*) FROM funeral f
            WHERE NOT EXISTS (SELECT 1 FROM public.sacrament_requirements r WHERE r.service_type_id = f.id AND r.is_required)
              AND EXISTS (SELECT 1 FROM public.sacrament_requirements r WHERE r.service_type_id = f.id))::bigint,
         NULL
  UNION ALL SELECT 4, 'death_certificates_not_required_or_not_first (backfilled rows must be required, order 1)',
         (SELECT count(*) FROM public.sacrament_requirements r
            JOIN funeral f ON f.id = r.service_type_id
            WHERE r.requirement_name = 'Death Certificate'
              AND r.created_at >= now() - interval '1 day'
              AND (r.is_required IS NOT TRUE OR r.display_order <> 1))::bigint,
         0
  UNION ALL SELECT 5, 'duplicate_death_certificates_on_one_funeral_service',
         (SELECT count(*) FROM (
            SELECT r.service_type_id
            FROM public.sacrament_requirements r
            JOIN funeral f ON f.id = r.service_type_id
            WHERE r.requirement_name = 'Death Certificate'
            GROUP BY r.service_type_id
            HAVING count(*) > 1
          ) d)::bigint,
         0
  UNION ALL SELECT 6, 'requirements_with_null_service_type_id',
         (SELECT count(*) FROM public.sacrament_requirements WHERE service_type_id IS NULL)::bigint,
         0
  UNION ALL SELECT 7, 'requirements_total (compare with the before snapshot)',
         (SELECT count(*) FROM public.sacrament_requirements)::bigint,
         NULL
  UNION ALL SELECT 8, 'appointment_documents_total (must equal the before snapshot)',
         (SELECT count(*) FROM public.appointment_documents)::bigint,
         NULL
  UNION ALL SELECT 9, 'requirement_fk_on_appointment_documents_is_on_delete_set_null',
         (SELECT count(*) FROM pg_constraint c
            WHERE c.conrelid = 'public.appointment_documents'::regclass
              AND c.confrelid = 'public.sacrament_requirements'::regclass
              AND c.contype = 'f'
              AND c.confdeltype = 'n')::bigint,
         1
  UNION ALL SELECT 10, 'requirement_fks_on_appointment_documents_that_are_not_set_null',
         (SELECT count(*) FROM pg_constraint c
            WHERE c.conrelid = 'public.appointment_documents'::regclass
              AND c.confrelid = 'public.sacrament_requirements'::regclass
              AND c.contype = 'f'
              AND c.confdeltype <> 'n')::bigint,
         0
  UNION ALL SELECT 11, 'appointment_documents_requirement_id_is_nullable',
         (SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'appointment_documents'
              AND column_name = 'requirement_id' AND is_nullable = 'YES')::bigint,
         1
  UNION ALL SELECT 12, 'backfill_function_exists',
         (SELECT count(*) FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'backfill_funeral_death_certificate')::bigint,
         1
  UNION ALL SELECT 13, 'backfill_function_callable_by_api_roles (anon, authenticated: must be false)',
         (SELECT count(*) FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'backfill_funeral_death_certificate'
              AND (has_function_privilege('anon', p.oid, 'EXECUTE')
                   OR has_function_privilege('authenticated', p.oid, 'EXECUTE')))::bigint,
         0
)
SELECT ord, check_name, actual_value, expected_value,
       CASE WHEN expected_value IS NULL THEN NULL ELSE actual_value = expected_value END AS ok
FROM checks
ORDER BY ord;

-- PART 2: details to read
-- 2a. Every Funeral checklist, parish by parish
-- SELECT c.name AS parish, t.name AS funeral_service, r.requirement_name, r.is_required, r.display_order, r.created_at
-- FROM public.church_service_types t
-- JOIN public.churches c ON c.id = t.church_id
-- LEFT JOIN public.sacrament_requirements r ON r.service_type_id = t.id
-- WHERE t.kind = 'funeral' AND t.deleted_at IS NULL
-- ORDER BY c.name, r.display_order;
