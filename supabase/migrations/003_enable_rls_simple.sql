-- Simple RLS: Enable it but allow authenticated users full access
-- This is more secure than disabled RLS, but not as granular as role-based policies

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Authenticated users full access" ON profiles;

-- Simple policy: Any user with a valid access token can access
-- This works with both Supabase client AND direct REST API
CREATE POLICY "Authenticated users full access"
ON profiles
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Note: This is better than no RLS, but doesn't enforce role-based restrictions
-- For production, you should use the more detailed policies in 003_enable_rls_profiles.sql
