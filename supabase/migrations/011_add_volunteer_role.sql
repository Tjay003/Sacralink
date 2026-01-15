-- Add 'volunteer' to user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'volunteer';
