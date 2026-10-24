-- Migration 082: Permissive RLS policies for appointment_documents
-- Ensures parishioners can upload, view, and delete their own documents,
-- and admins can view documents for verification.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'appointment_documents' AND policyname = 'Users can upload documents for own appointments'
  ) THEN
    CREATE POLICY "Users can upload documents for own appointments"
      ON public.appointment_documents
      FOR INSERT
      TO authenticated
      WITH CHECK (uploaded_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'appointment_documents' AND policyname = 'Users can view own documents'
  ) THEN
    CREATE POLICY "Users can view own documents"
      ON public.appointment_documents
      FOR SELECT
      TO authenticated
      USING (uploaded_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'appointment_documents' AND policyname = 'Users can delete own documents'
  ) THEN
    CREATE POLICY "Users can delete own documents"
      ON public.appointment_documents
      FOR DELETE
      TO authenticated
      USING (uploaded_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'appointment_documents' AND policyname = 'Admins can view all documents'
  ) THEN
    CREATE POLICY "Admins can view all documents"
      ON public.appointment_documents
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = ANY (ARRAY['super_admin'::user_role, 'church_admin'::user_role])
        )
      );
  END IF;
END $$;
