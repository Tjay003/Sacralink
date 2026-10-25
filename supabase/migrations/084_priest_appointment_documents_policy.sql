-- Migration 084: Allow priests to view appointment documents and storage objects
-- Priests presiding over sacrament appointments need to inspect and review certificates
-- and requirement documents (e.g. Baptismal Certificates, CENOMAR, Marriage Licenses,
-- Death Certificates) before performing liturgical rites.

DO $$
BEGIN
  -- 1. Update SELECT policy on public.appointment_documents
  DROP POLICY IF EXISTS "Admins can view all documents" ON public.appointment_documents;
  DROP POLICY IF EXISTS "Admins and priests can view all documents" ON public.appointment_documents;

  CREATE POLICY "Admins can view all documents"
    ON public.appointment_documents
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (
          profiles.role = ANY (ARRAY['super_admin'::user_role, 'church_admin'::user_role, 'admin'::user_role, 'priest'::user_role])
          OR COALESCE(profiles.is_priest, false) = true
        )
      )
    );

  -- 2. Update SELECT policy on storage.objects for appointment-documents bucket if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users and admins can view documents'
  ) THEN
    DROP POLICY IF EXISTS "Users and admins can view documents" ON storage.objects;

    CREATE POLICY "Users and admins can view documents" ON storage.objects
      FOR SELECT
      TO public
      USING (
        (bucket_id = 'appointment-documents'::text)
        AND (
          ((storage.foldername(name))[1] IN (
            SELECT (appointments.id)::text AS id
            FROM public.appointments
            WHERE appointments.user_id = auth.uid()
          ))
          OR
          (EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (
              profiles.role = ANY (ARRAY['super_admin'::user_role, 'admin'::user_role, 'church_admin'::user_role, 'priest'::user_role, 'volunteer'::user_role])
              OR COALESCE(profiles.is_priest, false) = true
            )
          ))
        )
      );
  END IF;
END $$;
