# 15: Reopen limit and linked follow-up ticket

Type: task
Status: ready-for-agent
**Blocked by:** 11, 12

**What to build:** A requester can reopen a Closed ticket at most **twice**; after that the Reopen button becomes **Raise a new ticket**, which creates a ticket linked to the old one. The handler can always reopen, without limit. Every reopen logs the existing system note.

Today `reopenTicket` (`web/src/lib/supabase/messaging.ts` ~1922) calls `updateTicketStatus(id, 'open')` and then posts a client-written `system` message (`event: 'ticket_reopened'`), and `MessagingPage.tsx` shows **Reopen Ticket** on the closed composer (~1597) for anyone who can see it. There is no count and no limit, and a client could forge the note.

**Counting choice (decision made in this ticket's design): a `reopen_count` column on `conversations`** (added in ticket 10a), incremented only inside the database function below. Counting `ticket_reopened` system notes instead would be forgeable by a client, breaks if a message is ever deleted, and needs a scan on every reopen; the column is updated atomically under the same row lock that checks it.

Migration (next free number; append to `APPLY_ALL_MIGRATIONS.sql`):
- `public.ticket_reopen(p_ticket_id uuid) RETURNS void` (`SECURITY DEFINER`, row lock, `GRANT` to `authenticated`): ticket must be `closed`. If the caller is `is_ticket_handler`: set `open`, no count change. Else if the caller is the requester (`created_by`): require `reopen_count < 2`, increment it, set `open`; otherwise raise a readable error (`ERRCODE 23514`, "You have reached the reopen limit. Raise a new ticket instead."). Anyone else is rejected. Writes the system note (metadata `{event: 'ticket_reopened', by: 'requester' | 'handler'}`).
- Only an explicit Reopen of a **Closed** ticket counts. The automatic Resolved to Open transition when the requester replies (ticket 11) does **not** count; see spec open question 3.
- `create_ticket` (ticket 10a) already accepts `p_linked_ticket_id`; add the validation here: the linked ticket must be one the caller created, must be `closed`, and must have `reopen_count >= 2` (follow-ups exist only for requesters who ran out of reopens). It copies `church_id`, `ticket_lane` and `category` defaults from the linked ticket when the caller leaves them out.

Web: `reopenTicket` calls `ticket_reopen` and no longer sends the note itself. On a closed ticket: handler sees **Reopen**; requester sees **Reopen** with "N of 2 reopens used" while under the limit, and **Raise a new ticket** at the limit, which opens `ParishInquiryModal` prefilled with the church, category, a subject "Follow-up: <old subject>" and the link; others see only the closed notice. The new ticket's header shows "Follow-up to TCK-######" (ticket 12) and links to the old one. Update `web/src/types/database.ts`.

- [ ] A requester reopens a Closed ticket the first and second time; the third attempt fails with the readable message and the UI offers Raise a new ticket.
- [ ] A handler can reopen any number of times and it never increases `reopen_count`.
- [ ] A client cannot change `reopen_count` or write a `ticket_reopened` note directly.
- [ ] A follow-up ticket links to the original, and only its own requester can create it, only at the limit.
- [ ] A reply on a Resolved ticket reopens it and does not consume a reopen.

**Test plan** (local `ticket-reopen.spec.ts`; edit the existing reopen assertions in `tickets-lifecycle-volunteer-badges.spec.ts`, which still pass for the first reopen): requester reopen 1, 2, then the third rejected; handler reopen unlimited and uncounted; forged note and direct count update rejected; the follow-up creation path through the UI at the limit; the Resolved-reply no-count case. Five or six tests. Serialize e2e.
