-- ============================================
-- SACRALINK - DROP ALL TABLES & ENUMS
-- Run this FIRST to clean up existing tables
-- ============================================

-- Drop triggers first
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists profiles_updated_at on profiles;
drop trigger if exists churches_updated_at on churches;
drop trigger if exists appointments_updated_at on appointments;
drop trigger if exists announcements_updated_at on announcements;

-- Drop functions
drop function if exists public.handle_new_user();
drop function if exists public.handle_updated_at();

-- Drop tables (in order of dependencies - children first, parents last)
drop table if exists public.activity_logs cascade;
drop table if exists public.appointment_documents cascade;
drop table if exists public.sacrament_requirements cascade;
drop table if exists public.donations cascade;
drop table if exists public.announcements cascade;
drop table if exists public.appointments cascade;
drop table if exists public.service_durations cascade;
drop table if exists public.priest_availability cascade;
drop table if exists public.mass_schedules cascade;
drop table if exists public.profiles cascade;
drop table if exists public.churches cascade;

-- Drop enums
drop type if exists user_role cascade;
drop type if exists appt_status cascade;
drop type if exists sacrament_type cascade;
drop type if exists donation_status cascade;

-- Done! Now you can run Sacralink_database.sql
