# 01: Database Constraint & Transfer RPC Migration

Type: task
Status: resolved
Blocked by: none

## Summary
Implement the PostgreSQL migration for strictly enforcing a single `super_admin` in the `profiles` table and creating the atomic `transfer_super_admin` RPC function.

## Scope & Implementation Details
1. Create a new migration file `supabase/migrations/026_single_super_admin_and_transfer_rpc.sql`.
2. Ensure there is only 1 `super_admin` currently in the DB before creating index (or clean up duplicates if any in dev).
3. Create a unique partial index:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS idx_single_super_admin ON profiles (role) WHERE role = 'super_admin';
   ```
4. Create the `transfer_super_admin` stored procedure / function with `SECURITY DEFINER`:
   ```sql
   CREATE OR REPLACE FUNCTION public.transfer_super_admin(target_user_id UUID)
   RETURNS jsonb
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public
   AS $$
   DECLARE
       caller_id UUID;
       caller_role TEXT;
       target_exists BOOLEAN;
   BEGIN
       caller_id := auth.uid();
       IF caller_id IS NULL THEN
           RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: No active session');
       END IF;

       -- Verify caller is super_admin
       SELECT role INTO caller_role FROM profiles WHERE id = caller_id;
       IF caller_role != 'super_admin' THEN
           RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Only the current Super Admin can transfer ownership');
       END IF;

       IF caller_id = target_user_id THEN
           RETURN jsonb_build_object('success', false, 'error', 'Target user is already the Super Admin');
       END IF;

       -- Check target user exists
       SELECT EXISTS(SELECT 1 FROM profiles WHERE id = target_user_id) INTO target_exists;
       IF NOT target_exists THEN
           RETURN jsonb_build_object('success', false, 'error', 'Target user not found');
       END IF;

       -- Atomic transfer
       -- 1. Demote current super admin to admin
       UPDATE profiles
       SET role = 'admin', updated_at = NOW()
       WHERE id = caller_id;

       -- 2. Promote target user to super_admin
       UPDATE profiles
       SET role = 'super_admin', assigned_church_id = NULL, updated_at = NOW()
       WHERE id = target_user_id;

       -- 3. Log to activity_logs
       INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
       VALUES (
           caller_id,
           'transfer_super_admin',
           'profiles',
           target_user_id,
           jsonb_build_object('previous_owner_id', caller_id, 'new_owner_id', target_user_id)
       );

       RETURN jsonb_build_object('success', true);
   END;
   $$;
   ```
5. Grant execution permissions: `GRANT EXECUTE ON FUNCTION public.transfer_super_admin(UUID) TO authenticated;`.

## Acceptance Criteria
- [x] Migration file created and appended to `APPLY_ALL_MIGRATIONS.sql` if appropriate.
- [x] Unique index rejects multiple `super_admin` records.
- [x] Function is secure and callable via Supabase client RPC.

## Resolution
1. Created `supabase/migrations/026_single_super_admin_and_transfer_rpc.sql` containing:
   - Partial unique index `idx_single_super_admin` on `profiles(role) WHERE role = 'super_admin'`.
   - Atomic `transfer_super_admin(target_user_id UUID)` `SECURITY DEFINER` stored function with session verification, caller authorization, recipient existence validation, caller demotion to `admin`, recipient promotion to `super_admin`, church unassignment, and structured audit logging into `activity_logs`.
   - Execution grant to `authenticated` role.
2. Updated `supabase/migrations/APPLY_ALL_MIGRATIONS.sql` with the migration script.
3. Updated `web/src/types/database.ts` with the typed RPC function signature.
