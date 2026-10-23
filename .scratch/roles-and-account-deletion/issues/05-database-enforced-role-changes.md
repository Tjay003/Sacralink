# 05: Database-enforced role changes

Type: task
Status: ready-for-agent
**Blocked by:** 02

**What to build:** Make the role rules impossible to bypass. Today `directUpdateProfile` (`web/src/lib/directApi.ts`) PATCHes `profiles` directly, and the policy `Church admins can update their church members` (`025_church_admin_view_users.sql`) has no `WITH CHECK` and matches any profile with `role = 'user'`. A church admin calling REST can set `role = 'super_admin'` or adopt users of other churches.

Build, in one migration (next free number; add to `APPLY_ALL_MIGRATIONS.sql`):

1. A `SECURITY DEFINER` function `public.set_user_role(p_user_id uuid, p_role user_role, p_church_id uuid DEFAULT NULL, p_is_priest boolean DEFAULT NULL) RETURNS void` (pattern: `046_appointment_changes_and_cancel.sql`: check `auth.uid()`, load rows `FOR UPDATE`, explicit SQLSTATEs, `GRANT EXECUTE` to `authenticated` only). Rules:
   - Caller `super_admin`: may set `user`, `volunteer`, `priest`, `church_admin` and any church. Never `super_admin` and never `admin` (Transfer Ownership remains the only path). Cannot target a `super_admin` row.
   - Caller `church_admin`: may set only `user`, `volunteer`, `priest`, `church_admin`; only for targets whose `assigned_church_id` equals the caller's, **or** users with `role = 'user'` and no church (joining the church). The resulting `assigned_church_id` is forced to the caller's church. Cannot target themselves. Cannot target a `super_admin`.
   - **Demotion** (new role `user`): sets `is_priest = false`, keeps `assigned_church_id`.
   - **Last Church Admin**: if the target is a `church_admin` and the new role is not `church_admin` and no other `church_admin` has that `assigned_church_id`, raise (`ERRCODE 23514`, "A church must keep at least one Church Admin").
   - Priest: `p_role = 'priest'` forces `is_priest = true`; `church_admin` may carry `is_priest` as today.
   - Writes one `activity_logs` row (`action = 'set_user_role'`, before/after role and church).
   - **Staff cleanup (spec decision 37).** When the change makes the person stop being staff of a church (new role `user`, or a move out of the church where they were staff), call `public.cleanup_staff_assignments(p_user_id uuid, p_church_id uuid)`, created in this migration (`SECURITY DEFINER`, internal, not granted to `authenticated`). Here it removes the person from that church's staff channel(s) (their `conversation_participants` rows in `type = 'channel'` conversations of that church). It is the single hook later tickets extend: ticket 13 adds the unassignment of their assigned church tickets with a system note, and `anonymize_user` (ticket 07) calls it too. Their own open platform tickets are never touched (the Super Admin finishes them). A change between staff roles of the same church (for example Volunteer to Priest) does not call it, and suspension does not call it.
2. Close the direct path: a `BEFORE UPDATE` trigger on `public.profiles` that raises when `role`, `assigned_church_id`, `church_id` or `is_priest` change and the change did not come from `set_user_role` (use a transaction-local setting, for example `set_config('app.role_change_ok','1',true)`, set inside the function). Existing self-service edits (name, phone, avatar) keep working. Replace the `Church admins can update their church members` policy with one that limits church admins to non-role columns or drop it entirely if nothing else needs it.
3. Keep `transfer_super_admin` working: it must set the same setting, or be exempted explicitly.

- [ ] A church admin cannot, by direct REST update or by RPC, set `super_admin`, set a user in another church, demote themselves, or demote the last Church Admin.
- [ ] A church admin can promote a church user to Church Admin and demote another Church Admin to `user` while the church still has a second Church Admin.
- [ ] Demotion leaves `assigned_church_id` and clears `is_priest`.
- [ ] Demoting or moving a staff member removes them from the church staff channel; a Volunteer promoted to Priest in the same church stays in it.
- [ ] A Super Admin can set any of the four roles on any church and cannot set `super_admin` or `admin`.
- [ ] A normal user cannot change their own role or church by direct update (already true by policy; stays true).
- [ ] `transfer_super_admin` still works.

**Test plan** (local, new spec `role-changes.spec.ts`; use `clientAs` for RLS calls and the service client for assertions; add a Super Admin and a second Church Admin in the same church to the setup helper if missing): table-driven cases per caller and target as listed above, including the direct-PATCH bypass attempts (each must fail), the last-Church-Admin guard in both orderings (demote then demote, and two admins demoting each other in sequence), and one happy path per caller. Add the staff-channel membership cases (removed on demotion and on a church change, kept on a same-church role change). Eight or nine tests, per the test workflow.
