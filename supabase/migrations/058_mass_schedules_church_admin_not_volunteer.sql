-- ==============================================================================
-- MIGRATION 058: Who may change a parish's Mass schedules
-- Rule (Tyrone, 2026-10-22): super_admin, plus the admin and church_admin of that parish.
-- Volunteers, priests and parishioners can read schedules but never change them.
--
-- Production allowed volunteers to write (policy listed admin, church_admin and volunteer), and a
-- database built from the migrations in this repo only allowed admin and super_admin, so a
-- church_admin was rejected locally. One policy name, one rule, on both. Reads are unchanged.
-- ASCII only so the file survives any shell encoding when piped into psql.
-- ==============================================================================

DROP POLICY IF EXISTS "Admins can manage church mass schedules" ON public.mass_schedules;

CREATE POLICY "Admins can manage church mass schedules"
  ON public.mass_schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role::text = 'super_admin'
          OR (
            p.role::text IN ('admin', 'church_admin')
            AND COALESCE(p.assigned_church_id, p.church_id) = mass_schedules.church_id
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role::text = 'super_admin'
          OR (
            p.role::text IN ('admin', 'church_admin')
            AND COALESCE(p.assigned_church_id, p.church_id) = mass_schedules.church_id
          )
        )
    )
  );

NOTIFY pgrst, 'reload schema';
