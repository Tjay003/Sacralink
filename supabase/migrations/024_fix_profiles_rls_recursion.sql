-- ============================================
-- MIGRATION 024: Fix Profiles RLS Recursion
-- ============================================
-- Problem:
--   The existing policies on `profiles` query the `profiles` table
--   from within a `profiles` policy, causing infinite recursion → 500 error.
--   e.g. "Super admins can view all profiles" does:
--     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
--   This triggers another RLS check on profiles → infinite loop.
--
-- Fix:
--   Create a SECURITY DEFINER function that runs as the DB owner (bypasses RLS)
--   to safely check the current user's role. Use this in all policies instead
--   of subqueries into the profiles table.
-- ============================================

-- Step 1: Create a safe role-checking function
-- SECURITY DEFINER means this runs as the function owner (postgres),
-- bypassing RLS on the internal profiles query. This breaks the recursion.
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Create a safe church_id-checking function for the same reason
CREATE OR REPLACE FUNCTION public.get_current_user_church_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT church_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Step 2: Drop ALL existing profiles policies (they all have recursion issues)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view church profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update church profiles" ON profiles;
-- Drop old leftover policies from earlier migrations
DROP POLICY IF EXISTS "Authenticated users full access" ON profiles;
DROP POLICY IF EXISTS "Super admins full access" ON profiles;
DROP POLICY IF EXISTS "Admins can view church members" ON profiles;

-- Step 3: Recreate all policies using the safe helper functions (no recursion)

-- Allow users to view their own profile (no subquery needed — safe)
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Allow users to update their own profile (but cannot change their own role)
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = public.get_current_user_role() -- Prevents self role-escalation
);

-- Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles"
ON profiles FOR SELECT
USING (public.get_current_user_role() = 'super_admin');

-- Super admins can update any profile (e.g. assign roles, church)
CREATE POLICY "Super admins can update all profiles"
ON profiles FOR UPDATE
USING (public.get_current_user_role() = 'super_admin');

-- Super admins can insert new profile rows (e.g. manual user creation)
CREATE POLICY "Super admins can insert profiles"
ON profiles FOR INSERT
WITH CHECK (public.get_current_user_role() = 'super_admin');

-- Admins can view profiles belonging to their own church
CREATE POLICY "Admins can view church profiles"
ON profiles FOR SELECT
USING (
  public.get_current_user_role() = 'admin'
  AND church_id = public.get_current_user_church_id()
);

-- Admins can update profiles in their church (but cannot change roles)
CREATE POLICY "Admins can update church profiles"
ON profiles FOR UPDATE
USING (
  public.get_current_user_role() = 'admin'
  AND church_id = public.get_current_user_church_id()
)
WITH CHECK (
  role = (SELECT role FROM profiles WHERE id = profiles.id) -- Prevents role changes
);

-- Allow new user profiles to be created on signup
-- (The auth trigger / edge function creates the profile row)
CREATE POLICY "Allow profile creation on signup"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);
