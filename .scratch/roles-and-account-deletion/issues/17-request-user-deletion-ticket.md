# 17: Request-user-deletion ticket (Church Admin side)

Type: task
Status: ready-for-agent
**Blocked by:** 07, 10a, 12

**What to build:** The way a Church Admin asks for a user to be deleted, since they cannot delete accounts themselves (spec decision 7). A dedicated ticket type, **Request user deletion**, on the platform lane: the Church Admin picks a user of their own church, gives a reason, and the Super Admin receives it with the user referenced. The Super Admin's review summary is ticket 18 and the decision actions are ticket 20.

Migration (next free number; append to `APPLY_ALL_MIGRATIONS.sql`):
- `ALTER TABLE public.conversations ADD COLUMN subject_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL` (set for deletion requests, and **optionally** for "Report a person or abuse" tickets, spec decision 28, where any church staff member may name a person of their own church or leave it blank; the same checks apply: own church, not themselves, not the Super Admin; `ON DELETE SET NULL` is a safety net, the anonymizing delete in ticket 07 keeps the profile row anyway).
- Extend `create_ticket` (ticket 10a) so category `user_deletion_request` is accepted only when: caller is a Church Admin; lane is `platform`; `p_subject_user_id` is a profile of the caller's own church (`assigned_church_id` or `church_id`), not the caller, not a `super_admin`, not already deleted (`deleted_at IS NULL`, the column ticket 07 adds); reason (the message) at least 20 characters; no other **open** deletion request for the same user (reject a duplicate with a readable error); at most **5 open deletion requests per Church Admin** (spec decision 39: clear error; they do not count toward the 3 general platform tickets of ticket 10a). The conversation title reads "Deletion request: <user name>".
- The ticket body keeps the Church Admin's reason as the first message, and `metadata` on that message carries `{event: 'user_deletion_request', subject_user_id}` so the thread is self-describing.

Web:
- `ParishInquiryModal` `platform` lane (ticket 10a): the category list for a Church Admin offers **General Question** and **Request user deletion** (the full per-role category lists are decided in spec decision 28 and wired in ticket 10a; the sacrament categories stay on the church lane). Priests and Volunteers use the platform lane with General Question, Report a problem and Report a person or abuse; **only the Church Admin can file Request user deletion**, enforced in `create_ticket`. When Report a person or abuse is chosen, show the same user picker as optional. Choosing Request user deletion reveals a user picker (search by name or email over the church's people, reusing the church-scoped people query in `web/src/lib/supabase/profiles.ts` around lines 246 and 266) and a required reason field with helper text about what the Super Admin will see.
- Add a **Request deletion** action on `UsersPage.tsx` rows for the Church Admin (hidden for the Super Admin, who has Delete from ticket 07) that opens the same flow with the user preselected. Extend `categories`/`getCategoryBadge` in `MessagingPage.tsx` with the new type ("Deletion request", warning style).
- Requester view of their own request: the normal ticket thread with status; no review summary and no actions.
- Update `web/src/types/database.ts`.

- [ ] A Church Admin can file a deletion request for a user of their church; the Super Admin receives it as a platform ticket naming that user.
- [ ] A Church Admin cannot target a user of another church, themselves or the Super Admin; a Priest, Volunteer or Parishioner cannot file this type; a duplicate open request is refused, and a sixth open deletion request from one Church Admin is refused (deletion requests do not use up the 3 general platform tickets).
- [ ] The Super Admin sees the ticket under Tickets; nobody else does.
- [ ] If the subject is deleted or suspended meanwhile the ticket still opens and shows the subject's current state (no crash on a Deleted User, see ticket 08).

**Test plan** (local `deletion-request-ticket.spec.ts`): permission and target-validation matrix via `clientAs` (own church yes; other church, self, Super Admin, short reason, duplicate no), visibility (Super Admin yes, another Church Admin no), one UI happy path from the Users page row action to the Super Admin's Tickets tab. Five tests. Serialize e2e.
