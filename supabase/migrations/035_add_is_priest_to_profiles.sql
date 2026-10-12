-- Migration: 035_add_is_priest_to_profiles.sql
-- Adds is_priest column and index to profiles table to support clergy administrators (e.g., church_admin who is an ordained priest)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_priest BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_profiles_is_priest ON public.profiles(is_priest);
