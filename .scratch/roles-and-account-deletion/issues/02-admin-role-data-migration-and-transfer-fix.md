# 02: Admin role data migration and transfer fix

Type: task
Status: ready-for-agent
**Blocked by:** None

**What to build:** One additive migration (next free number is `062`, add it to `supabase/migrations/APPLY_ALL_MIGRATIONS.sql` per repo convention) that retires the Admin role at the data level without touching RLS yet:

1. `CREATE OR REPLACE FUNCTION public.transfer_super_admin(UUID)` (from `026_single_super_admin_and_transfer_rpc.sql`) so the previous owner is demoted to `role = 'user'` instead of `'admin'`. Keep everything else (checks, `idx_single_super_admin`, activity log) identical.
2. `UPDATE public.profiles SET role = 'user', is_priest = false, updated_at = NOW() WHERE role = 'admin'`. Keep `assigned_church_id` and `church_id` so they stay in their church. Write one `activity_logs` row per converted account (`action = 'admin_role_retired'`) so the change is traceable.
3. A trigger `BEFORE INSERT OR UPDATE OF role ON public.profiles` that raises when `NEW.role = 'admin'` (`ERRCODE 22023`, message "The Admin role no longer exists"). The enum value `admin` stays in `user_role`; Postgres cannot drop it.

Order matters: the function change comes first in the file, then the data update, then the trigger.

- [ ] After the migration no profile has `role = 'admin'`.
- [ ] Converted accounts keep their church and can still log in as Parishioners.
- [ ] Inserting or updating a profile to `admin` fails with the new error, even with the service role.
- [ ] `transfer_super_admin` leaves the old owner as `user`, the target as `super_admin`, and still enforces a single Super Admin.
- [ ] Re-running the migration is a no-op (idempotent).

**Test plan** (local Docker Supabase, `web/e2e-local`, new spec `admin-role-retired.spec.ts`; one agent at a time):
- Seed an `admin` row with the service client before applying the migration function, run the data step, assert it is `user` with church kept.
- Assert direct `profiles` update to `admin` is rejected (service client and `clientAs`).
- Call `transfer_super_admin` as the Super Admin and assert the former owner's role is `user`.
- Back up first before production; apply from the main conversation only, then verify with a read-only `select role, count(*) from profiles group by role`.
