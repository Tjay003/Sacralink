# 19: Suspend and reactivate a user

Type: task
Status: ready-for-agent
**Blocked by:** 07

**What to build:** A reversible middle step between "do nothing" and "delete": the Super Admin can **suspend** an account (the person cannot sign in or use the app, nothing is lost) and **reactivate** it later. It is the safe option while a deletion request is being investigated (ticket 20 wires it to the request), and it is also available from the Users page.

Design (new capability; follows the same approach as ticket 07's anonymize, which already proves we can write `auth.users` from SQL on the local stack; if ticket 07 found that impossible, stop and report, same fallback):
- `ALTER TABLE public.profiles ADD COLUMN suspended_at timestamptz, ADD COLUMN suspended_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL, ADD COLUMN suspension_reason text`.
- `public.suspend_user(p_user_id uuid, p_reason text) RETURNS void` (`SECURITY DEFINER`, `GRANT` to `authenticated`): caller is `super_admin`; target is not the caller, not a `super_admin`, not deleted (`deleted_at IS NULL`), not already suspended; reason at least 10 characters. Sets the profile columns, sets `auth.users.banned_until = 'infinity'`, deletes the user's rows in `auth.refresh_tokens` and `auth.sessions` so the next refresh fails, writes `activity_logs` (`action = 'user_suspended'`). **Nothing else changes**: role, church, appointments, donations, messages and the email all stay.
- `public.reactivate_user(p_user_id uuid) RETURNS void`: caller is `super_admin`; clears the profile columns and sets `banned_until = NULL`; logs `user_reactivated`. Reactivating a deleted user is rejected.
- The `BEFORE UPDATE` trigger from ticket 05 that guards role columns is unaffected; add `suspended_at`, `suspended_by`, `suspension_reason` to the columns a client may never write directly (they change only through these functions).

**Instant cut-off (spec decision 26; the mechanism is built in ticket 07 step 4).** Suspend must take effect the same moment, even for a user with a valid access token. This ticket only adds `suspended_at`: `CREATE OR REPLACE public.is_user_blocked(_user_id uuid)` (behind `is_account_blocked()` and `direct_other_participant_blocked`, ticket 07) so it returns true when `deleted_at IS NOT NULL OR suspended_at IS NOT NULL`; the role helpers, `can_access_conversation*`, the restrictive per-table policies and the `assert_account_active()` calls from ticket 07 then pick it up with no further change. `suspend_user` also bans the auth user and deletes `auth.sessions` and `auth.refresh_tokens` (above). `reactivate_user` clears the flags and the ban; the policies stop blocking at once. A suspended user can still read their own profile row so the app sees the flag. The app-side listener from ticket 07 (`AuthContext`, Realtime on the own profile row plus a check on focus) also handles `suspended_at`, signs them out and shows the suspended message.

Web:
- Extend the `AuthContext` listener from ticket 07 to react to `suspended_at` (same sign-out path, different message).
- `UsersPage.tsx`: **Suspend** and **Reactivate** actions in the Super Admin's row menu with a confirmation modal (reason field on suspend; text states: cannot sign in, data kept, reversible). A **Suspended** badge on the row and a "Suspended" filter. Church Admin sees the badge only, no actions.
- Login (`web/src/pages/auth/` login page): map the GoTrue "User is banned" error to "This account is suspended. Contact your parish office or the Super Admin." instead of a generic failure.
- Suspended users disappear from pickers that offer assignable staff (assignment, celebrant pool, ticket 13 picker) the same way deleted users do in ticket 07 (`web/src/lib/supabase/profiles.ts` ~246 and ~266), but their past records still display normally with their name; a small "Suspended" mark next to the name where `UserName` (ticket 08) is used is optional and left to ticket 20's panel.
- Add `suspendUser(userId, reason)` and `reactivateUser(userId)` in `web/src/lib/supabase/profiles.ts`; update `web/src/types/database.ts`.

- [ ] A suspended user cannot sign in, cannot refresh a session, and sees the suspended message at login; their data, role, church and history are untouched.
- [ ] Nobody can post in a Direct chat whose other participant is suspended (REST rejected with "This user is no longer available", the rule from ticket 07); reactivating lifts it.
- [ ] **Immediate cut-off:** a user who is signed in with a valid access token when they are suspended gets no rows or an error on their very next request (REST, RPC, storage); their open tab signs them out and shows the suspended message. Reactivation restores access with a fresh sign-in.
- [ ] Reactivating restores sign-in with the same email and password and the same role and church.
- [ ] Only the Super Admin can suspend or reactivate; nobody can suspend the Super Admin, themselves, or a deleted user; a Church Admin calling the function is rejected.
- [ ] A suspended person no longer appears in staff and celebrant pickers.
- [ ] A client cannot write `suspended_at` directly through REST.

**Test plan** (local `suspend-user.spec.ts`; reuse the ticket 07 helpers): suspend through the real Users page, then assert with the service client that `auth.users.banned_until` is set and the sessions are gone, a fresh login attempt fails with the suspended message, reactivate and log in again, and the permission matrix through `clientAs` (Church Admin, Priest, self, Super Admin target rejected). **Instant cut-off test:** sign a user in with `clientAs`, keep the access token, suspend as Super Admin, then without refreshing assert the same client reads nothing from `appointments`, `notifications`, `conversations` and fails an RPC; reactivate and assert a fresh sign-in works. Six or seven tests. Serialize e2e. Prove the `auth.users` write locally first; production migration from the main conversation only.
