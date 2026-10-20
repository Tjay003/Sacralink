-- Migration 039: Add accept_cashless toggle to churches table
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS accept_cashless boolean DEFAULT true;
