-- ============================================
-- MIGRATION 023: Fix Notifications RLS
-- ============================================
-- Problem: The INSERT policy from migration 018 uses WITH CHECK (true),
-- meaning ANY authenticated user can create notifications for ANY other user.
-- Fix: Only admins and super_admins can push notifications to other users.
-- Regular users can only self-notify (which the app rarely needs directly anyway).
-- ============================================

-- Drop the overly permissive INSERT policies from previous migrations
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Allow authenticated users to create notifications for anyone" ON notifications;

-- Admin/super_admin can send notifications to any user (e.g. appointment approvals)
CREATE POLICY "Admins can create notifications for any user"
ON notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin', 'church_admin')
  )
);

-- Users can create notifications for themselves only (e.g. booking confirmation echo)
CREATE POLICY "Users can self-notify"
ON notifications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);
