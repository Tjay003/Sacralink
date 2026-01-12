-- Temporarily disable RLS on profiles to fix the 500 error
-- We'll re-enable it later with proper policies

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Note: This removes security but allows the app to work
-- For production, you'll need to fix the RLS policies to work with your auth setup
