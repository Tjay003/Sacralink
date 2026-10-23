# 06: Role editing and demotion UI

Type: task
Status: ready-for-agent
**Blocked by:** 05

**What to build:** Point the Users page at the new database function and shape the UI to the agreed rules. `web/src/components/admin/EditRoleModal.tsx` currently builds `availableRoles` locally and calls `directUpdateProfile` with `role`, `assigned_church_id`, `is_priest`.

- Add `setUserRole(userId, role, churchId?, isPriest?)` in `web/src/lib/supabase/profiles.ts` calling `supabase.rpc('set_user_role', ...)` and surfacing `error.message`. Stop sending role fields through `directUpdateProfile` (leave it for name and similar edits); update `web/src/types/database.ts` with the function signature.
- `EditRoleModal`: Super Admin sees Parishioner, Volunteer, Priest, Church Admin and a church picker. Church Admin sees the same four roles, no church picker (locked to their church). Remove the `admin` option (also covered by ticket 03; coordinate on the same lines).
- Add a clear **Demote to Parishioner** action in the modal and a quick action on the Users row for staff roles. Confirmation text: "<Name> will become a Parishioner and stay in <Church>. They lose staff access, leave the church staff channel, and tickets assigned to them go back to the Church Admin. Their own open tickets to the Super Admin stay open." No block-from-church wording.
- Hide or disable, with an inline reason, role editing for: yourself (no self-demotion), a Super Admin row, and (Church Admin view) users outside their church. Surface the database error for the last-Church-Admin case as readable text.
- `UsersPage.tsx`: Church Admin's list is limited to their own church plus parishioners without a church, matching what the function allows.

- [ ] Church Admin can change roles among the four allowed values for their church members and cannot see or pick anything else.
- [ ] Demotion confirmation appears (with the staff-channel and ticket wording) and the user ends as Parishioner in the same church and out of the staff channel.
- [ ] Self row has no demote option; last Church Admin shows the friendly error.
- [ ] Super Admin flow unchanged apart from the removed Admin option.

**Test plan** (local `role-editing-ui.spec.ts`): Church Admin promotes a parishioner to Volunteer and demotes a second Church Admin through the real modal (happy paths); the last-Church-Admin error message renders; the role picker offers exactly four roles for a Church Admin and no church picker. Assert final state with the service client. Three or four tests.
