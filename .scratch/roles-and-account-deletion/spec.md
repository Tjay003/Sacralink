# Specification: Roles and Account Deletion

Status: draft (roles and deletion agreed 2026-10-22; ticket flow agreed in a grilling session the same day and added as tickets 10a, 10b and 11 to 20; second round the same day added the ticket privacy rule, Super Admin visibility only after escalation, an all-church-staff platform lane, removal of the Parishioner office Direct-message shortcut, and instant cut-off on suspend/delete; third round the same day fixed the Direct-message matrix and hid escalated tickets from the Church Admin too; fourth round added the Parishioner concern route, requester-triggered escalation, churches without an admin, staff-removal cleanup, blocked-user messaging, rate-limit refinements and the attachments exclusion)
Source: client panel inquiries after the partial defense, discussed with Tyrone on 2026-10-22
Glossary: Church Admin, Super Admin, Parishioner, Priest, Volunteer (see `CONTEXT.md`); new terms in section 5

---

## 0. Reference: Direct-message matrix and ticket visibility matrix (all decided)

### Who can START a new Direct chat with whom

Enforced in the database (a creation function plus policies, ticket 10b), not only in the client, so REST cannot bypass it. A recipient can always reply; **existing Direct chats stay readable** and replyable; nothing is deleted or converted.

| Initiator (row) can start a chat with | Parishioner | Volunteer | Priest | Church Admin | Super Admin |
|---|---|---|---|---|---|
| **Parishioner** | no | no | no | no | no |
| **Volunteer** | no | no | no | no | no |
| **Priest** | yes, only one who shares an appointment with them (`appointments.priest_id` = the Priest) | no (staff channel) | no (staff channel) | yes, of their own church | no (platform ticket) |
| **Church Admin** | yes, of their own church only | yes, of their own church only | yes, of their own church only | yes, any church (own or other) | yes |
| **Super Admin** | no | no | no | yes, any church | n/a |

A Church Admin can therefore never start a chat with another church's parishioners, Priests or Volunteers (that church's own Church Admin is their route). Where "no" applies the person uses: a **ticket** (a Parishioner to the church; a Volunteer or Priest to the Super Admin through a platform ticket), or the **church staff channel** (Volunteers with anyone on staff, Priests with Volunteers or other Priests). The old Volunteer allowance (`isVolunteerAllowedContact`, client, and the restrictive policy `volunteer_may_add_participant` in migration `061`) and the Parishioner "message the office" shortcut (policy 2d of `036`) are removed.

**Chats the matrix no longer lets their starter open (legacy chats)** stay readable. For Parishioners and Volunteers they become **read-only for new messages**, with the banner "Please open a ticket", enforced in the database (an insert policy on `messages`), not only in the UI. Church Admins, the Super Admin and Priests can still reply and finish them. Chats between two Church Admins, or between a Church Admin and the Super Admin, are unaffected, and so is any chat whose starter could still start it today (for example one a Church Admin started with a parishioner of their own church).

### Who sees a ticket, by stage

| Stage | Requester | Church Admin (own church) | Assigned Priest/Volunteer | Other Priests/Volunteers | Super Admin |
|---|---|---|---|---|---|
| Church ticket, not assigned | yes (reply, reopen within limit) | yes, handler | n/a | no | **no** |
| Church ticket, assigned | yes | yes, handler | yes, handler | no | **no** |
| Church ticket, **escalated** | yes | **stub only**: one line "TCK-123 · Escalated to Super Admin" with the date; cannot open it | **no** (assignment cleared, no stub) | no | yes, handler |
| Sent back by the Super Admin | yes | yes, handler again | none (reassign if wanted) | no | no; cannot be escalated again |
| Platform ticket (staff raised) | yes | **no, not even the requester's own Church Admin** | no | no | yes, handler |
| Parishioner's concern about their church (`report_church`) | yes | **no, not even that church's Church Admin** | no | no | yes, handler; cannot be sent back |

**Escalation stub:** the Church Admin's stub exposes only the ticket number, the state and the date. It comes from a narrow `SECURITY DEFINER` list function (ticket 14), never from row access, so there is no way to open the ticket, read a message or reply. When the ticket is sent back it becomes a normal ticket again.

Who can raise what: Parishioner and Volunteer raise church tickets to their church's Church Admin (only if the church has a Church Admin); Church Admin, Priest and Volunteer raise platform tickets to the Super Admin; a Parishioner has exactly one platform category, "Report a concern about my church" (`report_church`), which goes straight to the Super Admin. Platform categories: Church Admin = General Question, Request user deletion, Church verification and setup, Report a problem, Report a person or abuse; Priest and Volunteer = General Question, Report a problem, Report a person or abuse; Parishioner = Report a concern about my church. Limits: at most 3 open platform tickets per person, not counting Request user deletion (5 open per Church Admin); 2 open concerns per Parishioner. The requester of a church ticket with no handler reply after 7 days can ask the Super Admin to review it, which escalates it. The Super Admin can send back an escalated church ticket or a Priest's or Volunteer's General Question or Report a problem, with a required note; never a Report a person or abuse ticket, a Parishioner's concern about their church, nor one a Church Admin raised.

---

## 1. Problem

The client's panel asked for clearer rules on who can change roles, who can delete users, and what happens to a church's data when a user goes away. Today:

- Role changes are plain `PATCH /rest/v1/profiles` calls from `directUpdateProfile` (`web/src/lib/directApi.ts`) guarded only by RLS. The Church Admin UPDATE policy (`025_church_admin_view_users.sql`) has **no `WITH CHECK`**, and its `USING` clause matches any profile whose role is `user` or who is already in the church. A church admin calling the REST API directly can promote anyone, including to `super_admin`, or adopt users from other churches. The rules in `EditRoleModal.tsx` exist only in the UI.
- There is no delete-user feature at all, and no self-delete.
- The `admin` role exists in the enum (`001_initial_schema.sql`) and in about 60 places in the web code and many RLS policies. The client does not need it: the Super Admin is one shared account for the 4 panelists.
- Large Text mode is a sidebar toggle the client wants gone.

## 2. Decisions (agreed)

| # | Decision |
|---|----------|
| 1 | **Large Text mode is removed** (sidebar toggle and the `text-lg` state in `DashboardLayout.tsx`). |
| 2 | **The Admin role is removed.** Existing admin accounts become Parishioners (`role = 'user'`). |
| 3 | **Super Admin** can change any user's role (except it never creates a second Super Admin: the single-Super-Admin index and Transfer Ownership stay). |
| 4 | **Church Admin** can set Parishioner, Priest, Volunteer or Church Admin, **only for users in their own church**. They can demote other Church Admins. They cannot demote themselves. A church must always keep at least one Church Admin. All of this is enforced in the database, not only the UI. |
| 5 | **Demotion** means the user becomes a Parishioner (`role = 'user'`, `is_priest = false`) and **stays in the church** (`assigned_church_id` kept). They lose staff access and role-specific features. They are not blocked from the church. |
| 6 | **Super Admin can delete any user except themselves.** There is one shared Super Admin account (the panel of 4), so the Super Admin has no self-delete. |
| 7 | **Church Admin cannot delete users.** They request it through a dedicated ticket type (decisions 12 to 24, tickets 17 to 20). |
| 8 | **Self-delete** exists for every role except Super Admin and takes effect **at once**. |
| 9 | Past appointments, donations and messages **are kept**. The person shows as **Deleted User** with a small danger icon; hovering it says "Deleted user". |
| 10 | Self-delete is **blocked with a clear message** for (a) a church's last Church Admin, who must name a successor first, and (b) a Priest with upcoming approved appointments. |
| 11 | When a user is deleted, their **open tickets are closed automatically** with a system note (ticket 07). |
| 12 | **Ticket lanes.** Parishioner and Volunteer raise tickets to their own church; the Church Admin of that church handles them. **All church staff (Church Admin, Priest and Volunteer) have the platform lane** and can ticket the Super Admin directly. **Parishioners have no general platform lane**: they reach the Super Admin by escalation (decision 13, or by asking for a review after 7 days, decision 35) or through the single narrow route "Report a concern about my church" (decision 34). Categories and limits on the platform lane are in decisions 28 to 31. |
| 13 | **Escalation.** A Church Admin, or the Priest or Volunteer a ticket is assigned to, can escalate a church ticket to the Super Admin; the Super Admin becomes the handler, the requester sees the status and the escalation note. After escalation **only the requester and the Super Admin see the ticket**: the assigned Priest or Volunteer and the Church Admin both lose all access (they no longer see, reply to or change it; the assignment is cleared), the Church Admin sees only a content-free stub (decision 32) and gets the ticket back only if the Super Admin sends it back. The Super Admin can send a ticket back down with a note (decision 31). |
| 14 | **Handlers.** The Church Admin plus the one person they assign (a Priest or Volunteer of the church). Only they reply as handler and change status. Nobody else on the church staff sees the ticket at all (decision 25). After escalation the Super Admin is the handler and nobody on the church staff has access. |
| 15 | **Placement.** Tickets appear only under the Tickets tab; All, Direct and Staff show no tickets; the Tickets tab shows real tickets only (a `ticket_number` is present). |
| 16 | **Statuses** stay Open, In Progress, Resolved, Closed. Only the handler gets the status dropdown; the requester sees a read-only badge. Enforced in the database. |
| 17 | **Light automation.** A handler's first reply moves Open to In Progress; a requester's reply on a Resolved ticket moves it to Open. Everything else is manual. |
| 18 | **Closed tickets** are read-only; Resolved still accepts replies. A requester may reopen a Closed ticket at most **2 times** (counted in a `reopen_count` column); then the button becomes "Raise a new ticket", linked to the old one. A handler can always reopen. Every reopen leaves a system note. |
| 19 | **Notifications** are in-app only (notifications table, bell, unread badge on the Tickets tab) for: new ticket, assignment, handler reply, requester reply, status change, escalation. No email. |
| 20 | **Categories** stay as they are, plus one new type, **Request user deletion**. |
| 21 | **Deletion request.** A Church Admin picks a user of their own church and gives a reason; it goes to the Super Admin as a ticket naming the user. |
| 22 | **Review summary.** On the request the Super Admin sees the reason, role, church, joined date, last sign-in, counts (appointments, donations, messages, tickets) and the last 10 recorded activities, from data we already have. No new activity logging. |
| 23 | **Decision.** The Super Admin can **Delete** (anonymize, ticket 07), **Suspend** (block sign-in, keep everything, reversible, ticket 19) or **Decline** (close the request with a note back to the Church Admin). |
| 24 | **Suspend** is reversible: **Reactivate** restores sign-in with the same role, church and history. The Super Admin cannot be suspended or deleted. |
| 25 | **Ticket privacy.** A church-lane ticket is visible only to its requester, the Church Admin(s) of that church and, while assigned and not escalated, the assignee. Other Priests, Volunteers and staff, **and the Super Admin**, cannot see it (list, counts, notifications, search, Realtime, REST, link) unless the Church Admin assigns it to them or it is escalated (then the Super Admin). Assigning grants access; unassigning, escalating, demoting or deleting the assignee removes it at once. After escalation the Church Admin loses visibility too: only the requester and the Super Admin can open an escalated ticket; the Church Admin sees only a content-free stub (decision 32) and gets the ticket back only if the Super Admin sends it back. A platform-lane ticket is visible only to its requester (a Church Admin) and the Super Admin. Enforced in the database (RLS), not only the UI. |
| 26 | **Instant cut-off.** Suspending or deleting a user takes effect the same moment, even for a signed-in user whose access token is still valid: the auth user is banned, all their sessions and refresh tokens are deleted, and a blocked-account check in the shared RLS helper functions plus a restrictive policy on every table makes an already-issued token read and write nothing. The app also signs the user out at once (Realtime on their profile flag, and a check when the tab regains focus). |
| 27 | **Direct messages follow a fixed matrix, and contacting the office always creates a ticket.** The matrix at the top of this spec says who can start a new Direct chat with whom, and it is enforced in the database (a creation function plus policies), not only in the client, so REST cannot bypass it. In short: Parishioners and Volunteers cannot start any Direct chat (they use a ticket, or the staff channel for Volunteers); a Priest can start one with a parishioner they share an appointment with and with Church Admins of their own church; a Church Admin with the Super Admin, other Church Admins (any church) and the parishioners, Priests and Volunteers of their own church; the Super Admin with Church Admins only. Church staff reach the Super Admin by platform ticket. **Existing Direct chats stay readable**; a chat whose starter could no longer start it becomes read-only for new messages from Parishioners and Volunteers (decision 33); otherwise recipients can always reply. The Volunteer allowance (`isVolunteerAllowedContact`, migration `061`) and the Parishioner office shortcut (policy 2d of `036`) are removed in client and database. |
| 28 | **Platform-lane categories.** Church Admin: General Question, Request user deletion, Church verification and setup, Report a problem, Report a person or abuse. Priest and Volunteer: General Question, Report a problem, Report a person or abuse. **Only the Church Admin can file Request user deletion.** Parishioners have exactly one platform category, `report_church` (decision 34). Stored as `general`, `user_deletion_request`, `church_setup`, `report_problem`, `report_person`, `report_church`; the allowed list per role lives in one place in `create_ticket` (ticket 10a). |
| 29 | **Platform tickets are private from the church.** A platform ticket is visible only to its requester and the Super Admin. A staff member's platform ticket is invisible to **their own Church Admin** (the Church Admin cannot see it, enforced in RLS), so staff can report problems or people, including a Church Admin, without that Church Admin reading it; the same holds for a Parishioner's concern about their church (decision 34). See the risk in section 6 (reversible in one line). |
| 30 | **Rate limit.** At most **3 open platform tickets** per person (status Open or In Progress), **not counting Request user deletion** (its own limit is 5 open per Church Admin, and a Parishioner's concerns are limited to 2 open, decision 39). A further ticket is rejected by `create_ticket` with a clear message. Resolved and Closed tickets free a slot. The church lane has no limit. |
| 31 | **Send back.** The Super Admin can send a ticket back down to the church (the Church Admin) with a **required note**, for an escalated church ticket or for a Priest's or Volunteer's platform ticket. It then becomes a church ticket visible to the requester and the Church Admin (there is no assignee, escalation cleared it), and **no longer to the Super Admin**. A ticket cannot be escalated again after it was sent back (no ping-pong). **Not available** for Report a person or abuse tickets and for a Parishioner's concern about their church (both may concern the Church Admin) nor for tickets a Church Admin raised (there is no one below them). |
| 32 | **Escalation stub.** After a church ticket is escalated, the Church Admin's ticket list shows one content-free line, "TCK-123 · Escalated to Super Admin", with the date. They cannot open it, see its messages or reply. The stub exposes only the ticket number, the state and the date, and is served by a narrow `SECURITY DEFINER` list function (ticket 14), never by granting row access. If the ticket is sent back it becomes a normal ticket again. The assignee gets no stub. |
| 33 | **Legacy Direct chats.** A Direct chat whose starter could not start it under the matrix today (for example a Parishioner or Volunteer chat with the office, or a Priest chat with a Volunteer) stays readable but becomes **read-only for new messages from Parishioners and Volunteers**, with the banner "Please open a ticket". This is enforced in the database (a restrictive insert policy on `messages` using `direct_is_legacy`, ticket 10b), not only in the UI. Church Admins, the Super Admin and Priests can still reply and finish such chats. Chats between two Church Admins, or a Church Admin and the Super Admin, and chats whose starter could still start them are unaffected. |
| 34 | **Parishioner concern route.** A Parishioner has exactly one platform category, **"Report a concern about my church"** (`report_church`). It goes straight to the Super Admin, is invisible to that church's Church Admin (decision 29), is limited to **2 open per Parishioner**, and **cannot be sent back** to the church (it may concern the Church Admin). It is the only exception to "Parishioners have no platform lane". |
| 35 | **Ask the Super Admin to review.** The requester of a church ticket that has had **no handler reply for 7 days** gets an "Ask the Super Admin to review" button. It escalates the ticket (requester-triggered escalation), under the same rules as escalation (not closed, not already escalated, never sent back), and leaves a system note. "No handler reply" means no non-system message from anyone other than the requester, on a ticket at least 7 days old. |
| 36 | **Church without a Church Admin.** If a church has no Church Admin, the New Ticket form says "This church has no administrator yet" and offers only the Report a concern route; `create_ticket` rejects a church-lane ticket for such a church. |
| 37 | **Leaving staff cleans up.** When someone stops being staff of a church (demotion, move, deletion) they are removed from the church staff channel, every church ticket assigned to them is unassigned and returns to the Church Admin with a system note, and their own open platform tickets stay open for the Super Admin to finish. Suspension does not trigger this (the role is kept); the Church Admin reassigns. |
| 38 | **No messages to a blocked user.** A deleted or suspended user cannot be messaged: the composer is disabled with "This user is no longer available", and the database rejects new messages in a Direct chat whose other participant is a blocked account. |
| 39 | **Rate limits, refined.** The 3-open limit on platform tickets (decision 30) does not count Request user deletion; Request user deletion has its own limit of **5 open per Church Admin**; a Parishioner has at most 2 open concerns about their church (decision 34). All are enforced in `create_ticket`. |
| 40 | **Changing home church.** A Parishioner who changes home church keeps their open tickets with the old church until they are closed; new tickets go to the new church (accepted behaviour, covered by a test in ticket 10a). |

## 3. Technical findings that shape the tickets

1. **Deleting the auth user would destroy the history.** `profiles.id` references `auth.users ON DELETE CASCADE` (`001`), `appointments.user_id` cascades from `auth.users` (`008`), and donations (`001`), messages `sender_id` (`027`), conversation members and notifications all cascade from `profiles`. Removing the `auth.users` row therefore wipes exactly what decision 9 says to keep. Deletion must be **anonymize in place**: keep the `profiles` row and the `auth.users` row, scrub personal data, and make login impossible. Dropping the cascade FKs instead is a larger, riskier change and is not proposed.
2. **No Edge Functions exist** (`supabase/functions` is empty). Account deletion therefore runs as a `SECURITY DEFINER` SQL function that also updates `auth.users` (anonymized email, banned, sessions and identities removed). This must be proven on the local Docker Supabase before anything touches production.
3. **`transfer_super_admin` demotes the old owner to `admin`** (`026_single_super_admin_and_transfer_rpc.sql`). With Admin removed it must demote to `user`. It must change **before** the admin data migration, or a transfer would recreate an admin.
4. **Postgres cannot drop an enum value.** `admin` stays dormant in `user_role` and a trigger rejects assigning it, instead of dropping it. Admin branches in RLS and database functions become dead code and are cleaned up in a later ticket.
5. **052 lockdown is still pending in production.** Migrations from `052_approve_reject_functions_and_lockdown.sql` onward replace appointment policies and functions that contain `'admin'` role checks. Cleaning those up (ticket 04) must wait until 052 is applied to production, otherwise the production database gets a half-applied sequence. The data and trigger migration (ticket 02) does not touch appointments and is independent of 052.
6. **Mobile still references `'admin'`** (7 places under `mobile/src`). Out of scope here; the dormant enum value keeps it from crashing.
7. The local seed (`web/e2e-local/global-setup.ts`) has one user per role listed in `docs/agents/local-testing.md` but no volunteer or Super Admin row is documented. Ticket 05 needs a Super Admin and a second Church Admin in the same church; its test plan adds them to the setup helper if missing.

8. **Ticket findings (read from the code, tickets 10a to 16).**
   - **Tickets are `conversations` rows** with `type = 'group'` and a `ticket_number` (`041`). The browser inserts them, generates the number (`Date.now()`, collision-prone), picks the participants, and falls back to **localStorage** when the insert fails (`submitParishOfficeInquiry`, `web/src/lib/supabase/messaging.ts`). The insert policy (`040`) lets any signed-in user create any group conversation.
   - **Why "ticket messages are not under Tickets":** `041` added `conversations.category DEFAULT 'general'`, so every conversation has a category, and the Tickets-tab filter in `MessagingPage.tsx` (`type === 'group' || category || ticket_number`) matches all of them (and ministry groups). Tickets also still appear under All. A parishioner who messages the parish office via the Direct "office gateway" (`036`) creates a plain DM with no ticket number, so staff see an inquiry under Direct with no status controls.
   - **Why "the status dropdown is hidden":** it renders only for `isStaff` plus a `ticket_number`; a DM-style inquiry has no ticket number, and a Volunteer who raised the ticket sees the dropdown on their own ticket. Separately, `updateTicketStatus` ignores affected rows, so an RLS no-op looks like success.
   - **Anyone who can read a ticket can reply and change its status** (`059`, `Staff can update ticket status` in `041`), including the requester, which also lets a requester rewrite any column of their ticket through REST. Closed tickets still accept replies. Tickets 11 to 15 move all of this into the database.
   - **A Super Admin has no church**, so the staff conversation query in `fetchUserConversations` never lists church tickets for them; platform and escalated tickets reach them through a participant row.
   - **"Query B" in `fetchUserConversations` (`messaging.ts` ~357) lists church-wide group tickets for any staff member of the church**, and `can_access_conversation` (`059`) lets every Church Admin, Volunteer and the Super Admin read any ticket. Both contradict decision 25 and are narrowed in tickets 11 and 12.

9. **The shared RLS helpers an instant cut-off must go through** (ticket 07, extended by ticket 19). `public.get_current_user_role()` and `public.get_current_user_church_id()` (`024`, redefined in `034`) are used by about 100 policies; `public.can_access_conversation`, `public.can_access_conversation_by_id` and `public.is_staff_channel` (`059`) and `public.is_conversation_participant` (`027`) gate messaging; `public.get_user_role(uuid)` (`036`) only reads another user's role and is left alone. Making the two `get_current_*` helpers return `NULL` for a blocked account removes every role-based grant, but **own-row policies** (`auth.uid() = user_id` on `appointments`, `donations`, `notifications`, `messages`, ...) do not call them, so they would still pass. The fix is a `RESTRICTIVE` policy on every user-facing table that requires `NOT public.is_account_blocked()` (migration `059` already uses `AS RESTRICTIVE`, so the pattern exists), with one exception: a blocked user may still `SELECT` their own `profiles` row so the app can read the flag and sign them out. `SECURITY DEFINER` functions granted to `authenticated` that rely only on `auth.uid()` need the same check at the top (`assert_account_active()`).

## 4. Out of scope

- Mobile app changes.
- Dropping the `admin` enum value.
- Data export before deletion, deletion grace period or undo (decision 8 says at once).
- Church Admin deleting users (request-by-ticket only, tickets 17 to 20).
- Email notifications for tickets.
- Ticket categories beyond the five platform categories in decision 28, a rate limit on the church lane, SLA timers or auto-closing stale tickets.
- New activity logging for the review summary (it uses what is already recorded).
- Converting or deleting **existing** Direct conversations (they stay readable, decision 27).
- **Ticket attachments.** No ticket attachment feature exists in the code today (checked by searching the code) and it is not wanted for now, so tickets carry text only. Storage stays inside the scope of the instant cut-off (ticket 07).
- Moving an open ticket to a new church when a Parishioner changes home church (decision 40: it stays with the old church).

## 5. Glossary additions (for `CONTEXT.md` once agreed)

- **Demotion**: removing a user's staff role so they become a Parishioner who stays in the church. _Avoid_: removal, kick, block.
- **Deleted User**: an account whose owner or the Super Admin deleted it. The row is kept, personal data is scrubbed, login is impossible, and it displays as "Deleted User" with a danger icon. _Avoid_: removed user, banned user.
- **Last Church Admin**: the only remaining Church Admin of a church. Cannot be demoted, removed or self-deleted until a successor exists.
- **Ticket lane**: the route a Parish Office Ticket takes. The **church lane** goes from a Parishioner or Volunteer to their church's Church Admin; the **platform lane** goes from church staff (a Church Admin, Priest or Volunteer) to the Super Admin, plus the Parishioner's single "Report a concern about my church" category. _Avoid_: queue, channel.
- **Handler**: the person currently allowed to reply as the office and change a ticket's status: the Church Admin or the Church Admin's assignee (church lane), or the Super Admin (platform lane or escalated). After escalation neither the Church Admin nor the assignee has access. Nobody else can see the ticket (see **Ticket privacy rule**). _Avoid_: owner, agent.
- **Requester**: the person who raised a ticket. They can reply and reopen but not change its status.
- **Assignment**: a Church Admin handing a church-lane ticket to one Priest or Volunteer of their church. **Assignment grants access**: before it the person cannot see the ticket at all; unassigning (or the person losing staff status) removes access at once.
- **Ticket privacy rule**: a church-lane ticket is visible only to the requester, the Church Admin(s) of the church and the current assignee; the Super Admin sees it only after escalation. A platform-lane ticket is visible only to its requester and the Super Admin.
- **Escalation**: a Church Admin, or the Priest or Volunteer the ticket is assigned to, passing a church-lane ticket to the Super Admin, who then becomes its handler. It is the only way the Super Admin sees a church ticket, and it hides the ticket from the Church Admin (who keeps only an **escalation stub**) and from the assignee until the Super Admin sends it back. _Avoid_: forward, transfer.
- **Send back**: the Super Admin returning a ticket to the church with a required note. The ticket becomes a church ticket for the Church Admin and loses its Super Admin visibility; it cannot be escalated again. Not allowed for Report a person or abuse tickets, a Parishioner's concern about their church, or tickets a Church Admin raised. _Avoid_: de-escalate, reject.
- **Escalation stub**: the content-free line a Church Admin sees for an escalated church ticket: ticket number, "Escalated to Super Admin" and the date. It cannot be opened and carries no subject, person or message; the assignee gets none.
- **Legacy Direct chat**: a Direct chat whose starter could not start it under today's matrix. It stays readable; Parishioners and Volunteers can no longer post in it (banner "Please open a ticket"), Church Admins, the Super Admin and Priests still can.
- **Concern about my church** (`report_church`): the one platform category a Parishioner has; goes straight to the Super Admin, invisible to the church's Church Admin, limit 2 open, never sent back.
- **Ask the Super Admin to review**: the requester's button on a church ticket with no handler reply after 7 days; it escalates the ticket.
- **Staff cleanup**: what happens when someone stops being staff of a church: removal from the staff channel and unassignment of their church tickets (their own platform tickets stay open).
- **Platform privacy**: a platform ticket is visible only to its requester and the Super Admin, never to the requester's own Church Admin.
- **Reopen limit**: a requester may reopen a Closed ticket twice; after that they raise a linked new ticket (the follow-up). Handlers are never limited.
- **Deletion request**: a platform-lane ticket in which a Church Admin asks the Super Admin to delete a user of their church, with a reason.
- **Review summary**: what the Super Admin sees about the subject of a deletion request (last sign-in, counts, recent recorded activity).
- **Suspend**: blocking an account from signing in without changing or removing anything; reversible with **Reactivate**. A suspended account keeps its role, church and history and is not shown as Deleted User. _Avoid_: ban, disable, deactivate.
- **Blocked account**: an account that is suspended or deleted. A blocked account can do nothing from the moment it is blocked, even with an access token issued earlier (decision 26); it can only read its own profile row so the app can sign it out.

## 6. Risks

- **Direct REST writes bypass the UI.** Until ticket 05 ships, any role rule in the UI is advisory.
- **Anonymizing `auth.users` is the least-tested path.** If the local stack rejects it, the fallback is a service-role Edge Function, which is new infrastructure.
- **Deleted User in every name render.** 30 `.tsx` files read `full_name`. Ticket 08 uses one shared component and must be checked on messages, appointments, donations and audit trail.
- **Two writers of ticket state.** Until ticket 11 ships, UI rules for tickets are advisory; the same lesson as role changes.
- **The instant cut-off touches every table.** The restrictive blocked-account policy (ticket 07) is added to every user-facing table and to storage, so a mistake in it can lock out everyone, not only blocked users. Ticket 07 must prove with a normal signed-in user that nothing else changes, run the full local suite once, and be released with a rollback migration ready.
- **Legacy Direct chats stay visible to everyone in them and bypass the ticket privacy rule for reading.** They cover Parishioner chats with Church Admins or the Super Admin, Volunteer chats, Church Admin chats with another church's parishioners, Priests or Volunteers, and Priest chats with Volunteers, other Priests or the Super Admin. They are not converted. Parishioners and Volunteers can no longer post in them (decision 33, enforced in the database, banner "Please open a ticket"), so the old office shortcut stops receiving new messages; Church Admins, the Super Admin and Priests can still reply. The remaining risk is only that old content stays readable by its participants, and it shrinks as the chats go quiet.
- **Staff lose Direct chats they used and must use the staff channel.** Volunteers, and Priests talking to Volunteers or other Priests, now go through the church staff channel (or a platform ticket for the Super Admin); a Church Admin still reaches their own church's Priests and Volunteers directly. Ticket 12 checks that every church has a staff channel the Volunteer and Priest can reach from New Message.
- **Escalating takes a ticket's content away from the people who were working on it.** The assigned Priest or Volunteer loses all access and gets no stub; the Church Admin loses access to the ticket's content but keeps a one-line stub (ticket number, "Escalated to Super Admin", date), so the church knows something is escalated without knowing what or who raised it, and cannot follow progress. Both see the ticket again only if the Super Admin sends it back. The requester keeps seeing the status. The escalate dialog warns whoever escalates. This is the confirmed decision (it reverses the earlier read-only default for the Church Admin); the cost that remains is that a church cannot see how an escalated ticket about itself is going.
- **Parishioners can now reach the Super Admin, so one shared account can be flooded.** Two routes open: the concern category (limit 2 open per Parishioner) and the 7-day review button (once per ticket, never after a send back). Both are rate-limited in the database; the Super Admin (the panel of 4 sharing one account) should expect more incoming tickets than before. A church also cannot see a concern raised about it (decision 34), the same trade-off as decision 29.
- **Staff-removal cleanup silently moves work.** Tickets assigned to someone who is demoted, moved or deleted go back to the Church Admin with a system note, and the person leaves the staff channel; the Church Admin should expect to reassign. Suspended staff are not cleaned up (decision 37), so a ticket assigned to a suspended person waits until the Church Admin reassigns it.
- **Church Admins cannot see what their staff report to the Super Admin (decision 29).** A Priest or Volunteer can report a problem or a person, even their own Church Admin, and that Church Admin never sees it. The trade-off is deliberate (safe reporting) but it means a church can have an open complaint about it that it does not know about. **One-line reversal:** in the platform branch of the ticket read predicate (`can_access_conversation`, ticket 11) add "or a Church Admin of the ticket's church"; the notification and list code (tickets 12 and 16) already follow that predicate. A sent-back ticket (decision 31) is the one case where the Church Admin does see a staff member's ticket, because the Super Admin chose to hand it down; the Super Admin should not send back a ticket that is about the Church Admin (Report a person or abuse is blocked for exactly that reason, but a General Question or Report a problem that touches the Church Admin can still be sent back by mistake).
- **Priests, Volunteers and the Super Admin lose sight of church tickets** they are not assigned to or that are not escalated, a behaviour change for staff who used to read and reply freely; ticket 11 updates the existing specs that assumed otherwise, and ticket 12 narrows the conversation list. Parishes that relied on a priest watching all tickets must now have the Church Admin assign them.
- **One shared Super Admin account** means the audit trail shows "Super Admin", never which panelist acted. Accepted by the client's panel; noted so it is a conscious trade-off.
- **A Priest self-deleting** with upcoming appointments is blocked, but a Priest assigned as `presiding_priest_id` or `requested_priest_id` on pending requests is not; ticket 09 must decide the check covers both (see ticket).

## 7. Tickets

| # | Ticket | Blocked by |
|---|--------|-----------|
| 01 | Remove Large Text mode | none |
| 02 | Admin role data migration and transfer fix | none |
| 03 | Remove Admin role from the web app | 02 |
| 04 | Remove Admin branches from RLS and database functions | 02, and 052 applied to production |
| 05 | Database-enforced role changes | 02 |
| 06 | Role editing and demotion UI | 05 |
| 07 | Super Admin deletes a user (anonymize foundation) | 02, 05 |
| 08 | Deleted User display everywhere | 07 |
| 09 | Self-delete with safeguards | 07, 08, 05 |
| 10a | Ticket data model, lanes and the create-ticket function | 02 |
| 10b | Direct-message rule (matrix, creation function, legacy chats) | 02 |
| 11 | Ticket permissions, status function and automatic status | 10a |
| 12 | Tickets tab placement and role-correct ticket UI | 10b, 11 |
| 13 | Ticket handler assignment | 05, 11, 12 |
| 14 | Escalate a ticket to the Super Admin and send it back | 11, 12 |
| 15 | Reopen limit and linked follow-up ticket | 11, 12 |
| 16 | Ticket notifications and the Tickets-tab badge | 13, 14, 15 |
| 17 | Request-user-deletion ticket (Church Admin side) | 07, 10a, 12 |
| 18 | Super Admin review summary on a deletion request | 17, 19 |
| 19 | Suspend and reactivate a user | 07 |
| 20 | Decision actions on a deletion request (Delete, Suspend, Decline) | 07, 16, 18, 19 |

## 8. Decisions summary and accepted defaults

**Open decisions: none.** The earlier open questions are closed: Volunteer Direct messages (removed, matrix above), church staff to the Super Admin (platform ticket only), and the Church Admin's visibility after escalation (none; they see the ticket again only if the Super Admin sends it back).

**Decided across the rounds:** the Super Admin sees a church ticket only after escalation and other staff only if assigned (decision 25); after escalation only the requester and the Super Admin see it (decision 13); all church staff have the platform lane, Parishioners do not, and an assigned Priest or Volunteer can escalate (decisions 12, 13); platform categories, privacy, rate limit and send back (decisions 28 to 31); suspend and delete cut off immediately (decision 26); the Direct-message matrix and the end of the office shortcut (decision 27); the Church Admin's escalation stub (decision 32) and read-only legacy Direct chats for Parishioners and Volunteers (decision 33); and in round four the Parishioner concern route, the 7-day review button, churches without a Church Admin, staff-removal cleanup, no messages to blocked users, the refined rate limits and the home-church rule (decisions 34 to 40).

**Accepted defaults (the user said these are fine; listed so they can still be vetoed):**
- A requester's reply on a Resolved ticket does **not** use up a reopen; only an explicit Reopen of a Closed ticket counts toward the limit of 2.
- When a Super Admin transfers ownership, the previous owner becomes a Parishioner (Admin no longer exists).
- A Priest's self-delete is blocked only by upcoming **approved** appointments, with a warning count of pending requests that name him as requested priest.
- A deleted user's profile photo, phone and other personal fields are scrubbed.
- A second open deletion request for the same user is refused (ticket 17).
- A Priest's "shares an appointment" test for starting a Direct chat uses any appointment row where he is `priest_id` for that parishioner (the existing rule), not only approved ones.
- Priests can still post in legacy Direct chats (only Parishioners and Volunteers are read-only), and a chat counts as legacy when its `created_by` could not start it today (when `created_by` is empty, when the matrix fails in both directions).
- The escalation stub shows the ticket number and date only; it has no subject, category, requester name or message count.
- A Parishioner's concern about their church stores the church it is about (any real church; it needs no Church Admin) and the "no handler reply" test for the 7-day review button is: no non-system message from anyone other than the requester, on a ticket at least 7 days old.
- Staff-removal cleanup runs on demotion, church change and deletion, not on suspension and not on a change between staff roles of the same church.
