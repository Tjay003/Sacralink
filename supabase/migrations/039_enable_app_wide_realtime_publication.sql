-- ============================================
-- MIGRATION 039: Enable App-Wide Realtime Publication
-- ============================================
-- Description:
--   Sets REPLICA IDENTITY FULL on core tables to ensure UPDATE/DELETE
--   payloads in Supabase Realtime carry complete record states (previous and new).
--   Adds core tables to PostgreSQL 'supabase_realtime' publication via an
--   idempotent PL/pgSQL block.
-- Tables:
--   - public.churches
--   - public.profiles
--   - public.appointments
--   - public.donations
--   - public.notifications
--   - public.church_announcements
--   - public.system_announcements
-- ============================================

-- 1. Set REPLICA IDENTITY FULL on all core tables
ALTER TABLE public.churches REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER TABLE public.donations REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.church_announcements REPLICA IDENTITY FULL;
ALTER TABLE public.system_announcements REPLICA IDENTITY FULL;

-- 2. Idempotently add each table to supabase_realtime publication
DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY[
    'churches',
    'profiles',
    'appointments',
    'donations',
    'notifications',
    'church_announcements',
    'system_announcements'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    END IF;
  END LOOP;
END $$;
