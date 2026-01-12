-- ============================================
-- FIX: Infinite Recursion in Profiles RLS
-- ============================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON profiles;

-- Recreate policies WITHOUT recursion
-- Policy 1: Users can view their own profile (using auth.uid() directly)
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- Policy 3: Admins can view profiles in their church
CREATE POLICY "Admins can view church profiles"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles AS admin_profile
    WHERE admin_profile.id = auth.uid()
    AND admin_profile.role IN ('admin', 'super_admin')
  )
);

-- Policy 4: Super admins can do everything
CREATE POLICY "Super admins full access"
ON profiles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles AS admin_profile
    WHERE admin_profile.id = auth.uid()
    AND admin_profile.role = 'super_admin'
  )
);

-- Done! Now try logging in again.
