# 20: Decision actions on a deletion request (Delete, Suspend, Decline)

Type: task
Status: ready-for-agent
**Blocked by:** 07, 16, 18, 19

**What to build:** The three buttons the Super Admin has on a deletion-request ticket (they exist only on `user_deletion_request` tickets; on a Report a person or abuse ticket that names someone, the Super Admin sees the review panel from ticket 18 and acts through the Users page Suspend and Delete from tickets 07 and 19, and the ticket uses the normal statuses; "Send back" from ticket 14 is not offered on either type), next to the review summary (ticket 18). Each acts on the ticket and on the subject user in one step, so the ticket never says one thing while the account says another.

Database (next free migration number; append to `APPLY_ALL_MIGRATIONS.sql`): one function per action, all `SECURITY DEFINER`, row-locked on the ticket, `GRANT` to `authenticated`, **raising unless the caller is the `super_admin`** and the ticket is a `user_deletion_request` that is not `closed`:
- `public.ticket_request_delete(p_ticket_id uuid)`: runs the same checks as `public.delete_user_account` (ticket 07: subject is not the Super Admin and not the caller) and then calls the internal `public.anonymize_user` for `subject_user_id`, sets the ticket `resolved`, writes the system note "<name> deleted the account of <user>". The subject's own open tickets are closed by `anonymize_user` (ticket 07); this deletion-request ticket was raised by someone else, so it is resolved here.
- `public.ticket_request_suspend(p_ticket_id uuid, p_reason text)`: calls `suspend_user` (ticket 19) with the reason, sets the ticket `in_progress`, writes "<name> suspended <user> pending review". The Super Admin can later Delete, Reactivate (below) or Decline.
- `public.ticket_request_decline(p_ticket_id uuid, p_note text)`: note at least 10 characters; sets the ticket `closed` and writes the note as a system message addressed to the Church Admin ("Request declined: <note>"); if the user was suspended through this ticket, **it asks first** (the UI warns) and does not reactivate silently, the Super Admin uses Reactivate.
- Reactivation is `reactivate_user` from ticket 19, exposed on the ticket panel while the subject is suspended; it leaves the ticket status alone (the Super Admin then Declines or Deletes it).
- All three go through the ticket 11 trigger lock without extra flags (`SECURITY DEFINER`), and ticket 16's triggers notify the requesting Church Admin about the status change and the note, so no notification code is added here.
- If the subject was already deleted or suspended by another path, the function rejects the redundant action with a readable message instead of failing in the middle.

Web: in the Super Admin's Review panel (ticket 18) add **Delete user**, **Suspend** and **Decline request** buttons. **Delete** reuses the confirmation style from ticket 07 (types the user's email, lists what happens: history kept as Deleted User, cannot sign in, pending requests cancelled, open tickets closed) and shows the extra warning when the subject is the last Church Admin of their church. **Suspend** asks for a reason. **Decline** asks for a note to the Church Admin. After an action the panel shows the new state and the ticket status updates. The requesting Church Admin sees only the resulting status and note. Add the three client helpers in `web/src/lib/supabase/messaging.ts`; update `web/src/types/database.ts`.

- [ ] Delete from the ticket anonymizes the user exactly as ticket 07 does and resolves the ticket in one transaction; a failure leaves both untouched.
- [ ] Suspend blocks the user's sign-in (ticket 19) and leaves the ticket In Progress; the Super Admin can still Delete or Decline afterwards.
- [ ] Decline closes the ticket and the Church Admin receives the note and a notification; the subject user is not touched.
- [ ] Only the Super Admin can run these functions; a Church Admin, including the requester, is rejected.
- [ ] A Church Admin still cannot delete or suspend directly (ticket 07 and 19 rules unchanged).
- [ ] Delete and Suspend from the ticket cut the subject off immediately (they reuse `anonymize_user` and `suspend_user`, so the instant cut-off from tickets 07 and 19 applies; no extra code).
- [ ] The three actions appear only on `user_deletion_request` tickets, never on a Report a person or abuse ticket, and a deletion request cannot be sent back (its requester is a Church Admin).

**Test plan** (local `deletion-request-actions.spec.ts`): create a deletion request through ticket 17's path, then for each action assert the user state (anonymized, banned, untouched) and the ticket status and note with the service client, plus the Church Admin notification for Decline and Delete. One assertion that a subject signed in with an already-issued token is rejected right after Suspend and after Delete from the ticket. One UI test for the Super Admin's three buttons end to end. Permission cases via `clientAs`. Six tests. Serialize e2e; production migration from the main conversation only, after backing up `profiles`, `conversations` and `messages`.
