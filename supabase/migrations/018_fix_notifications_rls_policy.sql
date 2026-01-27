-- Fix RLS policy for notifications
-- Migration: 018_fix_notifications_rls_policy

-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;

-- Create a more permissive INSERT policy
-- Allow any authenticated user to create notifications for any other user
-- This is needed because:
-- - Admins need to notify users about appointment approvals/rejections
-- - Users need to notify admins about new appointments
CREATE POLICY "Allow authenticated users to create notifications for anyone"
ON notifications
FOR INSERT
TO authenticated
WITH CHECK (true);
