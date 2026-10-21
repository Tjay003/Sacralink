-- ==============================================================================
-- VERIFY migration 056 (church-owned service types): read-only
-- Run on the database AFTER applying 056. Nothing here writes. Part 1 is one result set; every
-- row with expected_value filled must show ok = true. Part 2 lists details for a human to read.
--
-- Compare appointments_total and requirements_total with the numbers from
-- 056_service_types_before.sql (production had 48 appointments when 056 was written): they must
-- be identical, the migration never adds or removes appointments or requirements.
-- ==============================================================================

-- PART 1: checks
WITH starters(kind) AS (
  VALUES ('baptism'), ('wedding'), ('funeral'), ('confirmation'), ('blessing'), ('other')
),
churches_with_six AS (
  SELECT c.id
  FROM public.churches c
  WHERE (
    SELECT count(DISTINCT t.kind)
    FROM public.church_service_types t
    JOIN starters s ON s.kind = t.kind
    WHERE t.church_id = c.id
  ) = 6
),
checks AS (
  SELECT 1 AS ord, 'churches_total' AS check_name,
         (SELECT count(*) FROM public.churches)::bigint AS actual_value,
         NULL::bigint AS expected_value
  UNION ALL SELECT 2, 'churches_with_the_six_starter_services',
         (SELECT count(*) FROM churches_with_six)::bigint,
         (SELECT count(*) FROM public.churches)::bigint
  UNION ALL SELECT 3, 'churches_without_the_six_starter_services',
         (SELECT count(*) FROM public.churches c WHERE c.id NOT IN (SELECT id FROM churches_with_six))::bigint,
         0
  UNION ALL SELECT 4, 'appointments_total (compare with the before snapshot)',
         (SELECT count(*) FROM public.appointments)::bigint, NULL
  UNION ALL SELECT 5, 'appointments_with_null_service_type_id',
         (SELECT count(*) FROM public.appointments WHERE service_type_id IS NULL)::bigint, 0
  UNION ALL SELECT 6, 'appointments_linked_to_a_service_of_another_parish',
         (SELECT count(*) FROM public.appointments a
            JOIN public.church_service_types t ON t.id = a.service_type_id
            WHERE t.church_id <> a.church_id)::bigint, 0
  UNION ALL SELECT 7, 'requirements_total (compare with the before snapshot)',
         (SELECT count(*) FROM public.sacrament_requirements)::bigint, NULL
  UNION ALL SELECT 8, 'requirements_with_null_service_type_id',
         (SELECT count(*) FROM public.sacrament_requirements WHERE service_type_id IS NULL)::bigint, 0
  UNION ALL SELECT 9, 'requirements_linked_to_a_service_of_another_parish',
         (SELECT count(*) FROM public.sacrament_requirements r
            JOIN public.church_service_types t ON t.id = r.service_type_id
            WHERE t.church_id <> r.church_id)::bigint, 0
  UNION ALL SELECT 10, 'duplicate_live_names_per_church',
         (SELECT count(*) FROM (
            SELECT church_id, lower(name)
            FROM public.church_service_types
            WHERE deleted_at IS NULL
            GROUP BY church_id, lower(name)
            HAVING count(*) > 1
          ) d)::bigint, 0
  UNION ALL SELECT 11, 'appointment_text_differs_from_service_name (legacy spelling, informational)',
         (SELECT count(*) FROM public.appointments a
            JOIN public.church_service_types t ON t.id = a.service_type_id
            WHERE a.service_type IS DISTINCT FROM t.name)::bigint, NULL
  UNION ALL SELECT 12, 'services_created_from_unmatched_text (hidden, no kind; review in Part 2)',
         (SELECT count(*) FROM public.church_service_types WHERE kind IS NULL AND is_hidden)::bigint, NULL
  UNION ALL SELECT 13, 'link_triggers_present (appointments and sacrament_requirements)',
         (SELECT count(*) FROM pg_trigger
            WHERE tgname = 'trg_link_service_type' AND NOT tgisinternal
              AND tgrelid IN ('public.appointments'::regclass, 'public.sacrament_requirements'::regclass))::bigint, 2
  UNION ALL SELECT 14, 'appointments_check_constraints_mentioning_service_type',
         (SELECT count(*) FROM pg_constraint
            WHERE conrelid = 'public.appointments'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%service_type%')::bigint, 0
  UNION ALL SELECT 15, 'church_service_types_row_level_security_enabled',
         (SELECT count(*) FROM pg_class
            WHERE oid = 'public.church_service_types'::regclass AND relrowsecurity)::bigint, 1
)
SELECT check_name,
       actual_value,
       expected_value,
       CASE WHEN expected_value IS NULL THEN NULL ELSE actual_value = expected_value END AS ok
FROM checks
ORDER BY ord;

-- PART 2: details (run separately, read by a human)

-- 2a. Services per parish: the six starters plus anything the backfill created from unmatched text
-- SELECT c.name AS church, t.display_order, t.name, t.kind, t.is_hidden, t.deleted_at IS NOT NULL AS deleted,
--        (SELECT count(*) FROM public.appointments a WHERE a.service_type_id = t.id) AS appointments,
--        (SELECT count(*) FROM public.sacrament_requirements r WHERE r.service_type_id = t.id) AS requirements
-- FROM public.church_service_types t
-- JOIN public.churches c ON c.id = t.church_id
-- ORDER BY c.name, t.display_order;

-- 2b. Only the services created from text that matched no starter (hidden; the parish can unhide or delete them)
-- SELECT c.name AS church, t.name, t.created_at
-- FROM public.church_service_types t
-- JOIN public.churches c ON c.id = t.church_id
-- WHERE t.kind IS NULL AND t.is_hidden
-- ORDER BY c.name, t.name;
