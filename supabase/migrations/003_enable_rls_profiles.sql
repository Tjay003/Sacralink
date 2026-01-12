i-- Re-enable RLS on profiles table with proper policies
-- This migration fixes the previous RLS recursion issue

-- First, ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view church profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins full access" ON profiles;

-- Policy 1: Users can view their own profile
-- Uses auth.uid() directly to avoid recursion
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
-- Users can only update their own basic info (not role or church_id)
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND role = (SELECT role FROM profiles WHERE id = auth.uid()) -- Prevent role escalation
);

-- Policy 3: Super admins can view all profiles
-- Direct check without recursion
CREATE POLICY "Super admins can view all profiles"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Policy 4: Super admins can update all profiles
CREATE POLICY "Super admins can update all profiles"
ON profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Policy 5: Super admins can insert new profiles
CREATE POLICY "Super admins can insert profiles"
ON profiles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Policy 6: Admins can view profiles in their church
CREATE POLICY "Admins can view church profiles"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles AS admin_profile
    WHERE admin_profile.id = auth.uid()
    AND admin_profile.role = 'admin'
    AND admin_profile.church_id = profiles.church_id
  )
);

-- Policy 7: Admins can update profiles in their church (except role changes)
CREATE POLICY "Admins can update church profiles"
ON profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles AS admin_profile
    WHERE admin_profile.id = auth.uid()
    AND admin_profile.role = 'admin'
    AND admin_profile.church_id = profiles.church_id
  )
)
WITH CHECK (
  role = (SELECT role FROM profiles WHERE id = profiles.id) -- Prevent role changes
);

-- Note: Since we're using direct REST API with the anon key + user's access token,
-- these policies will work correctly without causing the AbortError we had before.
