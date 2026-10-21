-- ==============================================================================
-- BEFORE migration 056 (church-owned service types): read-only snapshot
-- Run this on the database BEFORE applying 056 and keep the numbers. Compare them with
-- 056_service_types_verify.sql after the migration: the totals must be identical because the
-- migration only adds services and links, it never adds or removes appointments or requirements.
-- Works on a database that does not have the new table or columns yet. Read-only.
-- ==============================================================================

SELECT
  (SELECT count(*) FROM public.churches) AS churches_total,
  (SELECT count(*) FROM public.appointments) AS appointments_total,
  (SELECT count(*) FROM public.sacrament_requirements) AS requirements_total,
  (SELECT count(DISTINCT lower(btrim(service_type::text))) FROM public.appointments) AS distinct_appointment_service_texts,
  (SELECT count(DISTINCT lower(btrim(service_type::text))) FROM public.sacrament_requirements) AS distinct_requirement_service_texts;

-- Every distinct text the backfill will have to link. Texts that are not one of the six starters
-- (baptism, wedding, funeral, confirmation, blessing, other) become hidden services of their parish.
SELECT 'appointments' AS source, lower(btrim(service_type::text)) AS service_text, count(*) AS row_count
FROM public.appointments
GROUP BY 1, 2
UNION ALL
SELECT 'sacrament_requirements', lower(btrim(service_type::text)), count(*)
FROM public.sacrament_requirements
GROUP BY 1, 2
ORDER BY 1, 2;
