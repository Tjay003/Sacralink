# 05: Implement indefinite Archive & Admin-Safe Restore for Churches and 7-day Archive & Auto-Delete for Users

Type: task
**Blocked by:** 04
**Status:** ready-for-agent

**What to build:** Replace destructive hard-deletion of churches and immediate PII-wiping deletion of users with an **Archive & Restore** system while keeping the action buttons worded `"Delete Church"` and `"Delete Account"` / `"Delete User"`:

1. **Database Migration (`supabase/migrations/088_archive_churches_and_users.sql`)**:
   - **Church Archiving (Indefinite — No 7-Day Auto-Delete)**:
     - Add `archived_at timestamptz DEFAULT NULL` and `archived_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL` to `public.churches` (and allow `'archived'` in `churches.status` if constrained).
     - Update `public.delete_church(p_church_id uuid)` so instead of `DELETE FROM public.churches`:
       - It records the church's current primary `church_admin` into `v_archived_admin_id`.
       - It demotes all staff (`church_admin`, `priest`, `volunteer`) of `p_church_id` to `role = 'user'`, `assigned_church_id = NULL`, `church_id = NULL`, `is_priest = false` (and removes them from the staff channel via `cleanup_staff_assignments`), freeing them from the archived church.
       - It preserves all `appointments`, `donations`, `mass_schedules`, `church_announcements`, and `church_images` intact.
       - It updates `public.churches SET status = 'archived', is_active = false, archived_at = now(), archived_admin_id = v_archived_admin_id WHERE id = p_church_id`.
     - Create `public.church_restore_status(p_church_id uuid) RETURNS jsonb` to inspect `archived_admin_id` and return whether the former `church_admin` is still available (`role = 'user' AND assigned_church_id IS NULL AND archived_at IS NULL AND deleted_at IS NULL`) or whether they now hold a role at another church (returning their name and current church name).
     - Create `public.restore_church(p_church_id uuid, p_new_admin_id uuid DEFAULT NULL) RETURNS jsonb`:
       - If the former `church_admin` (`archived_admin_id`) is still a free `user` and `p_new_admin_id IS NULL`, automatically restore them to `role = 'church_admin', assigned_church_id = p_church_id, church_id = p_church_id`.
       - If the former `church_admin` is unavailable (e.g. already has a role at another church or is archived/deleted), require `p_new_admin_id` (who must be an active `role = 'user'` with no staff role elsewhere) and promote `p_new_admin_id` to `role = 'church_admin'` of `p_church_id`.
       - Set `status = 'active', is_active = true, archived_at = NULL, archived_admin_id = NULL` on `public.churches`, ensure the church's Staff Channel via `ensure_church_staff_channel(p_church_id)`, and log `restore_church` in `activity_logs`.
   - **User Archiving (7-Day Archive Window + Auto-Delete After 7 Days)**:
     - Add `archived_at timestamptz DEFAULT NULL` to `public.profiles`.
     - Update `public.assert_account_active()` so users with `archived_at IS NOT NULL` are blocked from mutations just like suspended/deleted accounts.
     - Create `public. purge_expired_archived_users() RETURNS integer` (`SECURITY DEFINER`) that finds all profiles with `archived_at IS NOT NULL AND deleted_at IS NULL AND archived_at <= now() - interval '7 days'` and runs `public.anonymize_user(id, NULL, 'auto_purge_7_days')` on each so expired archived users are permanently anonymized/deleted after 7 days.
     - Update `public.delete_user_account(p_user_id uuid)` so when an admin deletes a user:
       - First runs `PERFORM public.purge_expired_archived_users();`.
       - Enforces the Last Church Admin guard (`Cannot delete the only Church Admin of a church`).
       - Instead of immediately running `anonymize_user`, keeps `full_name`, `email`, `phone_number`, and `avatar_url` intact, demotes any staff role (`priest`, `volunteer`, or secondary `church_admin`) to `role = 'user', assigned_church_id = NULL, church_id = NULL, is_priest = false` (cleaning up staff channel assignments), cancels pending appointments, and sets `archived_at = now(), updated_at = now()`.
     - Create `public.restore_user_account(p_user_id uuid) RETURNS void` (`SECURITY DEFINER`) that verifies `super_admin` or `church_admin` permission, checks `archived_at IS NOT NULL AND deleted_at IS NULL`, and clears `archived_at = NULL, updated_at = now()` (restoring the user as an active `role = 'user'` parishioner).

2. **Frontend Church Archive & Restore UI (`ChurchesPage.tsx`, `ChurchDetailPage.tsx`, `DeleteChurchModal.tsx`)**:
   - Keep the action button labeled `"Delete Church"`, updating the confirmation text in `DeleteChurchModal.tsx` to explain that the church will be moved to the **Archived** tab (all historical donations, appointments, and schedules preserved; staff reset to parishioners).
   - Filter out `church.status === 'archived'` from all public/parishioner church lists, dropdowns, and active views.
   - In `ChurchesPage.tsx`, add an **`"Active"` / `"Archived"`** view tab for `super_admin`.
   - In the **`"Archived"`** tab on `ChurchesPage.tsx`, render archived churches with an `"Archived"` badge and a **`"Restore Church"`** button that opens `RestoreChurchModal`:
     - If `church_restore_status` reports the former `church_admin` is available, show *"Former Church Admin [Name] is available and will automatically be restored as Church Admin"* and restore on confirm.
     - If the former `church_admin` now has a role at another church (or is unavailable), display *"Former admin [Name] is currently assigned to [Other Church]. Please select a user below to become the new Church Admin to restore this church"* with a searchable dropdown of eligible `user` accounts, requiring selection before restoring.

3. **Frontend User 7-Day Archive & Restore UI (`UsersPage.tsx`, `DeleteUserModal.tsx`, `directApi.ts`, `profiles.ts`)**:
   - Keep the action button labeled `"Delete Account"` in `UsersPage.tsx`, updating `DeleteUserModal.tsx` copy to inform the admin that the user will be moved to the **Archived** tab for **7 days** (where they can be restored before automatic permanent deletion).
   - Trigger `purge_expired_archived_users` when loading `UsersPage` (or inside `directFetchProfiles`) so any user past the 7-day archive window is automatically permanently deleted.
   - Exclude archived users (`archived_at !== null`) from the default Active directory list, and add an **`"Active"` / `"Archived"`** filter tab on `UsersPage.tsx`.
   - In the **`"Archived"`** tab on `UsersPage.tsx`, display each archived user's preserved `full_name` and `email`, a countdown badge (`"X days left before permanent deletion"` calculated from `archived_at + 7 days`), and a **`"Restore User"`** button that calls `restore_user_account` and returns them to the Active list as a Parishioner (`user`).

## Acceptance Criteria
- [ ] Clicking `"Delete Church"` moves the church to `status = 'archived'` without deleting its appointments/donations, demotes its staff to `user`, hides it from parishioners, and never auto-deletes it after 7 days.
- [ ] In `ChurchesPage.tsx` (`"Archived"` tab), clicking `"Restore Church"` auto-restores the former `church_admin` if they have no role at another church; if they already have a role at another church, the modal requires picking a replacement `church_admin` from available `user` accounts before restoring.
- [ ] Clicking `"Delete Account"` in `UsersPage.tsx` moves the user to the `"Archived"` tab with their name/email preserved and a **7-day countdown badge**, blocks their account while archived, and resets any staff role to `user`.
- [ ] Clicking `"Restore User"` in the `"Archived"` tab of `UsersPage.tsx` restores the user as an active `user` (`parishioner`).
- [ ] Any user whose `archived_at` is older than 7 days is automatically permanently deleted/anonymized.
- [ ] Verified against local Docker Supabase (`web/e2e-local`), and `tsc -b` + `vite build` pass cleanly.
