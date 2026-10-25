-- Migration 086: Schema Sync for Church Favorites and Donation Supporters
-- Fixes local schema drift to align with remote / production Supabase definitions.

-- 1. Create church_favorites table if not exists
CREATE TABLE IF NOT EXISTS public.church_favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  church_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT church_favorites_pkey PRIMARY KEY (id),
  CONSTRAINT church_favorites_user_id_church_id_key UNIQUE (user_id, church_id),
  CONSTRAINT church_favorites_church_id_fkey FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE CASCADE,
  CONSTRAINT church_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.church_favorites ENABLE ROW LEVEL SECURITY;

-- 2. Create idempotent RLS policies on public.church_favorites
DROP POLICY IF EXISTS "Admins can read all favorites" ON public.church_favorites;
CREATE POLICY "Admins can read all favorites"
  ON public.church_favorites
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role::text IN ('super_admin', 'church_admin')
    )
  );

DROP POLICY IF EXISTS "Users can follow a church" ON public.church_favorites;
CREATE POLICY "Users can follow a church"
  ON public.church_favorites
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unfollow a church" ON public.church_favorites;
CREATE POLICY "Users can unfollow a church"
  ON public.church_favorites
  FOR DELETE
  TO public
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own favorites" ON public.church_favorites;
CREATE POLICY "Users can view their own favorites"
  ON public.church_favorites
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

-- 3. Add show_as_supporter column to donations
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS show_as_supporter boolean NOT NULL DEFAULT false;
