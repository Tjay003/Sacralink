# 09: Self-delete with safeguards

Type: task
Status: ready-for-agent
**Blocked by:** 05, 07, 08

**What to build:** Every role except Super Admin can delete their own account from the profile page, and it takes effect at once, using the same anonymize engine as ticket 07 (history kept, shown as Deleted User, signed out immediately, email freed).

Database (next free migration number; append to `APPLY_ALL_MIGRATIONS.sql`): a `SECURITY DEFINER` wrapper `public.delete_own_account()` granted to `authenticated` that uses `auth.uid()` and calls `anonymize_user`. It raises (readable messages, distinct SQLSTATEs) when:
- the caller is `super_admin` ("The Super Admin account cannot be deleted");
- the caller is the **last Church Admin** of their church, defined with the same predicate as ticket 05 ("Name a successor Church Admin before deleting your account");
- the caller is a Priest (`role = 'priest'` or `is_priest`) with **upcoming approved appointments** as `priest_id` (or `presiding_priest_id`; check `054_celebrant_eligibility_foundation.sql` for which column is authoritative) dated today or later ("You have N upcoming appointments. Ask the parish office to reassign them first"). Pending requests that merely name him as requested priest do not block.

Web: a **Delete my account** section at the bottom of `web/src/pages/ProfilePage.tsx` (the one routed at `profile` in `App.tsx`; `web/src/pages/profile/ProfilePage.tsx` also exists and is not imported there, so confirm before editing), hidden for Super Admin. Confirmation modal with the consequences (signed out immediately, cannot be undone, history stays as Deleted User) and a typed-email confirmation. Show the database messages for the blocked cases inline, before the confirm step if the check is cheap to run first (a read-only `can_delete_own_account()` helper may be added). On success: sign out and navigate to `/login`.

- [ ] A parishioner, volunteer, non-last Church Admin and a Priest without upcoming appointments can delete themselves; they are signed out at once and cannot log back in.
- [ ] The last Church Admin of a church, the Super Admin and a Priest with upcoming approved appointments are blocked with the specified messages and nothing changes.
- [ ] After a successful delete the person appears as Deleted User (ticket 08) and their history is intact.
- [ ] The Super Admin never sees the delete section.
- [ ] The person is cut off the instant the delete succeeds: their own still-valid access token is rejected on the next request (the mechanism from ticket 07 step 4 applies; `delete_own_account()` needs no extra code, but it must be covered by the test).
- [ ] The person's open tickets are closed automatically with a system note (inherited from `anonymize_user`, ticket 07); nothing is left waiting on a deleted account.

**Test plan** (local `self-delete.spec.ts`): happy path through the real profile page for a parishioner; blocked cases for last Church Admin, Priest with an upcoming approved appointment, and Super Admin (assert state unchanged with the service client); one case where a second Church Admin exists and the first can delete; the happy path also asserts the person's open ticket ended `closed`. Add one assertion in the happy path that the access token the person held before deleting returns no rows afterwards. Six tests. Serialize with other e2e agents.
