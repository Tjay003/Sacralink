-- Migration: 031_add_appointment_priest_and_feedback.sql
-- Adds priest_id and admin_feedback to appointments table
-- Updates RLS policies so priests can view and manage their assigned sacrament appointments

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS priest_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS admin_feedback TEXT;

CREATE INDEX IF NOT EXISTS idx_appointments_priest_id ON public.appointments(priest_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'appointments' AND policyname = 'Priests can view their appointments'
    ) THEN
        CREATE POLICY "Priests can view their appointments"
        ON public.appointments FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'priest'
            AND (
              appointments.priest_id = auth.uid()
              OR profiles.church_id = appointments.church_id
              OR profiles.assigned_church_id = appointments.church_id
            )
          )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'appointments' AND policyname = 'Priests can update their assigned appointments'
    ) THEN
        CREATE POLICY "Priests can update their assigned appointments"
        ON public.appointments FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'priest'
            AND (
              appointments.priest_id = auth.uid()
              OR profiles.church_id = appointments.church_id
              OR profiles.assigned_church_id = appointments.church_id
            )
          )
        );
    END IF;
END $$;
