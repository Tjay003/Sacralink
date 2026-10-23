# 16: Ticket notifications and the Tickets-tab badge

Type: task
Status: ready-for-agent
**Blocked by:** 13, 14, 15

**What to build:** In-app notifications for ticket activity, using the existing `notifications` table, the bell (`web/src/components/notifications/NotificationBell.tsx`) and an unread badge on the Tickets tab. No email.

Where it lives: **database triggers**, not client calls. Today notifications are written from the browser (`createNotification` in `web/src/lib/supabase/notifications.ts`, called for appointments and donations); for tickets that would let a client skip them or notify the wrong people, and the status changes now happen inside `SECURITY DEFINER` functions anyway. The `notifications` table is `(id, user_id, type, title, message, link, is_read, created_at)` with `user_id` cascading from `profiles`; trigger functions run as the owner and so bypass the insert policy.

Migration (next free number; append to `APPLY_ALL_MIGRATIONS.sql`):
- `AFTER INSERT ON public.conversations` (ticket rows) and `AFTER UPDATE OF status, assigned_to, escalated_at` plus `AFTER INSERT ON public.messages` (non-system messages on tickets) triggers calling one `SECURITY DEFINER` function `public.notify_ticket_event()`. Events, recipients and `type`:

| Event | Recipients | type |
|-------|------------|------|
| New ticket, church lane | every Church Admin of the church | `ticket_new` |
| New ticket, platform lane | the Super Admin | `ticket_new` |
| Assignment | the assignee (not on unassign) | `ticket_assigned` |
| Handler reply | the requester | `ticket_reply` |
| Requester reply | the handlers (Church Admins of the church and the assignee while the ticket is not escalated; only the Super Admin once it is escalated, and on a platform ticket) | `ticket_reply` |
| Status change | the requester (and the assignee if the Church Admin changed it) | `ticket_status` |
| Escalation | the Super Admin and the requester | `ticket_escalated` |
| Reopen by the requester | the handlers | `ticket_status` |
| Sent back by the Super Admin (ticket 14) | the requester and the church's Church Admins; nothing to the Super Admin | `ticket_sent_back` |

- **Recipients pass the same visibility check as RLS** (spec decision 25): `notify_ticket_event()` reuses the ticket read predicate from ticket 11, so a notification is never written for someone who cannot read the ticket: an unassigned Priest or Volunteer, a previous assignee, another church's Church Admin, or the Super Admin on a non-escalated church ticket. Handlers for "requester reply" and "reopen" are therefore the church's Church Admins and the **current** assignee only. **After escalation notifications stop for the assignee and for the Church Admin entirely** (neither can read the ticket and their unread ticket notifications are deleted by ticket 14); the only ticket notification they receive again is the **send back**. After a send back the Church Admin is notified as for any church ticket.
- Never notify the person who acted. `link` is `/messages?conv=<id>` (ticket 12 makes that land on the Tickets tab). Titles name the ticket number and subject ("TCK-000123: Maria replied").
- Avoid floods: for `ticket_reply`, if the recipient already has an **unread** `ticket_reply` for the same conversation, update that row's message and `created_at` instead of inserting another.
- Account deletion (ticket 07) already removes the deleted user's notifications; nothing to add here.

Web: the NotificationBell renders the new types with an icon and links through (check how it uses `link`). In `MessagingPage.tsx`, the **Tickets** tab shows the sum of `unreadCount` over tickets (already computed per conversation in `fetchUserConversations`) as a small badge, hidden at zero; the sidebar Messages badge (`get_my_unread_message_count`, `061`) already includes tickets and stays. Opening a ticket marks it read as today.

- [ ] Each event in the table creates the right notification for the right people and none for the actor.
- [ ] Repeated replies collapse into one unread notification per recipient per ticket.
- [ ] Clicking a ticket notification opens the Tickets tab on that ticket and marks the notification read.
- [ ] The Tickets tab shows an unread count and hides it at zero; non-ticket conversations never add to it.
- [ ] After a ticket is escalated neither the assignee nor the Church Admin receives any further notification for it (their unread ones are gone) until a send back notifies the Church Admin.
- [ ] A Church Admin of another church, a Priest/Volunteer who is not the assignee (including a previous assignee), the Super Admin before escalation and a Parishioner who is not the requester receive nothing.

**Test plan** (local `ticket-notifications.spec.ts`): drive each event through the real RPCs/messages as the right caller, and assert `notifications` rows with the service client (recipients, type, no actor, collapsing). One UI test: the bell badge increments and the link opens the ticket on the Tickets tab. Five or six tests. Serialize e2e.
