-- ============================================
-- MIGRATION 025: Church Admin Can View All Regular Users
-- ============================================
-- Problem:
--   Church Admins (church_admin role) had NO SELECT policy beyond their own
--   profile. They could not see regular users in the Users tab, making it
--   impossible to promote anyone to Volunteer.
--
-- Fix:
--   Add a SELECT policy for church_admin that allows them to see:
--   1. All profiles with role = 'user' (so they can find people to promote)
--   2. Profiles already assigned to their church (their existing volunteers/co-admins)
-- ============================================

-- Drop if exists (re-runnable)
DROP POLICY IF EXISTS "Church admins can view their church members and all users" ON profiles;

-- Church Admin SELECT policy:
-- Can see anyone who is a plain 'user' (to recruit as volunteer)
-- OR anyone already assigned to their church
CREATE POLICY "Church admins can view their church members and all users"
ON profiles FOR SELECT
USING (
  public.get_current_user_role() = 'church_admin'
  AND (
    -- Regular users (can be promoted)
    role = 'user'
    -- OR already part of their church staff
    OR assigned_church_id = public.get_current_user_church_id()
  )
);

-- Also allow church_admin to UPDATE profiles in their church
-- (needed so EditRoleModal can actually save the role change)
DROP POLICY IF EXISTS "Church admins can update their church members" ON profiles;

CREATE POLICY "Church admins can update their church members"
ON profiles FOR UPDATE
USING (
  public.get_current_user_role() = 'church_admin'
  AND (
    -- Can update regular users (to assign them as volunteer to their church)
    role = 'user'
    -- OR already assigned to their church
    OR assigned_church_id = public.get_current_user_church_id()
  )
);
