-- ==============================================================================
-- BEFORE migration 057 (Funeral default checklist): read-only snapshot
-- Run on the database BEFORE applying 057 and keep the numbers. The migration only adds
-- checklist rows, so after it: requirements_total = requirements_total_before + the number of
-- parishes counted in parishes_that_will_get_the_death_certificate, and nothing else changes.
-- Read-only.
-- ==============================================================================

SELECT
  (SELECT count(*) FROM public.sacrament_requirements) AS requirements_total,
  (SELECT count(*) FROM public.appointment_documents) AS appointment_documents_total,
  (SELECT count(*)
     FROM public.church_service_types t
     WHERE t.kind = 'funeral' AND t.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.sacrament_requirements r WHERE r.service_type_id = t.id)
  ) AS parishes_that_will_get_the_death_certificate,
  (SELECT count(*)
     FROM public.church_service_types t
     WHERE t.kind = 'funeral' AND t.deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM public.sacrament_requirements r WHERE r.service_type_id = t.id)
  ) AS parishes_with_their_own_funeral_checklist_left_untouched,
  (SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'appointment_documents' AND column_name = 'requirement_id'
  ) AS appointment_documents_requirement_id_nullable,
  (SELECT string_agg(pg_get_constraintdef(c.oid), '; ')
     FROM pg_constraint c
     WHERE c.conrelid = 'public.appointment_documents'::regclass
       AND c.confrelid = 'public.sacrament_requirements'::regclass
       AND c.contype = 'f'
  ) AS current_requirement_fk;

-- Which parishes will get it (read it before applying)
SELECT c.name AS parish, t.name AS funeral_service_name, t.is_hidden
FROM public.church_service_types t
JOIN public.churches c ON c.id = t.church_id
WHERE t.kind = 'funeral' AND t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.sacrament_requirements r WHERE r.service_type_id = t.id)
ORDER BY c.name;
