# Map: Roles and Account Deletion

Spec: `spec.md`. Manual test script: `TESTING-GUIDE.md`. Fresh-session handoff: `HANDOFF.md`. Tickets live in `issues/`. Run e2e one agent at a time (shared local DB, see `docs/agents/test-workflow.md`). Production migrations are applied from the main conversation only.

## Decisions so far
- Admin role removed, admins become Parishioners; enum value stays dormant.
- Role rules enforced in the database via a function plus trigger, not UI only.
- Deletion = anonymize in place, never delete the `auth.users` row (cascades would erase history). Open tickets of a deleted user are closed with a system note.
- Tickets have two lanes (church lane: Parishioner/Volunteer to the Church Admin; platform lane: church staff (Church Admin, Priest, Volunteer) to the Super Admin). A Church Admin or the assignee can escalate a church ticket to the Super Admin, and the Super Admin can send a ticket back with a note (not Report a person or abuse, not tickets a Church Admin raised; ticket 14). Parishioners have only one platform category, "Report a concern about my church".
- **Platform categories** (ticket 10a): Church Admin = General Question, Request user deletion, Church verification and setup, Report a problem, Report a person or abuse; Priest and Volunteer = General Question, Report a problem, Report a person or abuse. At most 3 open platform tickets per person. A staff member's platform ticket is invisible to their own Church Admin (reversible in one line, spec risks).
- **Direct messages follow a fixed matrix** (top of `spec.md`, enforced in the database by ticket 10b and in the pickers by ticket 12): Parishioners and Volunteers start none; a Priest can start one with a parishioner they share an appointment with and with Church Admins of their own church; a Church Admin with the Super Admin, other Church Admins (any church) and the parishioners, Priests and Volunteers of their own church; the Super Admin with Church Admins only. Staff reach the Super Admin by platform ticket; Volunteers and Priests reach each other through the staff channel. Existing chats stay readable; a chat its starter could no longer start becomes read-only for new messages from Parishioners and Volunteers (banner "Please open a ticket", enforced by a restrictive insert policy on `messages`: ticket 10b for the database, ticket 12 for the banner). Contacting the parish office always creates a ticket.
- **Ticket privacy:** a church ticket is visible only to the requester, the church's Church Admin(s) and the assignee. Other Priests/Volunteers and the Super Admin cannot see it until it is assigned (grants access) or escalated (Super Admin). After escalation the assignee and the Church Admin both lose all access; only the requester and the Super Admin see an escalated ticket (the Church Admin sees only a content-free stub "TCK-… · Escalated to Super Admin" with the date, from a narrow function in ticket 14, and gets the ticket back only on a send back). Enforced by RLS (ticket 11), list (12), assignment (13), notifications (16).
- **Parishioner concern route:** a Parishioner has one platform category, "Report a concern about my church" (`report_church`): straight to the Super Admin, invisible to that church's Church Admin, 2 open max, never sent back. A requester can also "Ask the Super Admin to review" a church ticket with no handler reply after 7 days (escalates it). A church with no Church Admin takes no church tickets; only the concern route is offered. (tickets 10a, 12, 14)
- **Rate limits:** 3 open platform tickets per person not counting Request user deletion; 5 open deletion requests per Church Admin; 2 open concerns per Parishioner (ticket 10a, 17).
- **Staff removal cleanup:** demotion, move or deletion removes the person from the church staff channel (ticket 05), unassigns their church tickets with a system note (ticket 13), leaves their own platform tickets for the Super Admin; suspension does not.
- **Blocked users cannot be messaged:** the database rejects new messages in a Direct chat whose other participant is deleted or suspended (ticket 07, extended by 19); the composer says "This user is no longer available" (ticket 12).
- **Home church change:** open tickets stay with the old church until closed; new tickets go to the new church (ticket 10a test).
- **Out of scope:** ticket attachments (none exist today, not wanted for now).
- Handler = Church Admin plus the one person they assign (after escalation, the Super Admin). Only handlers change status; enforced in the database. Light auto-status only (first handler reply, requester reply on Resolved).
- Tickets appear only under the Tickets tab. Closed is read-only; requester reopens at most twice, then a linked follow-up ticket. In-app notifications only.
- Church Admin requests user deletion with a ticket; the Super Admin sees a review summary and can Delete, Suspend (reversible) or Decline. The Super Admin is one shared account and cannot be deleted or suspended.
- **Suspend and delete cut off immediately**, even with an already-issued access token: ban + delete sessions + blocked-account check in the RLS helpers and a restrictive policy on every table (built in ticket 07, extended by 19), plus an app-side sign-out (Realtime on the own profile row, check on focus).

## Dependency graph (an arrow means "unblocks")
```
02 -> 03, 04 (also needs 052 in production), 05, 07, 10a, 10b
05 -> 06, 07, 09, 13
07 -> 08, 09, 17, 19, 20
08 -> 09
10a -> 11, 17
10b -> 12
11 -> 12, 13, 14, 15
12 -> 13, 14, 15, 17
13, 14, 15 -> 16
16 -> 20
17 -> 18
19 -> 18, 20
18 -> 20
01 has no dependencies
```
No cycles. Dependencies are unchanged by the second round; ticket 07 now also carries the instant cut-off mechanism (a wider migration, so run the full local suite after it), ticket 19 only extends it, and 11 and 13 together implement the privacy rule. Suggested order for one agent at a time: 01, 02, 03, 05, 06, 07, 08, 09, 10a, 10b, 11, 12, 13, 14, 15, 16, 19, 17, 18, 20; ticket 04 waits for 052 in production.

## Tasks
- [ ] 01 Remove Large Text mode
- [ ] 02 Admin role data migration and transfer fix
- [ ] 03 Remove Admin role from the web app (after 02)
- [ ] 04 Remove Admin branches from RLS and functions (after 02 and 052 in production)
- [ ] 05 Database-enforced role changes (after 02)
- [ ] 06 Role editing and demotion UI (after 05)
- [ ] 07 Super Admin deletes a user (after 02, 05)
- [ ] 08 Deleted User display everywhere (after 07)
- [ ] 09 Self-delete with safeguards (after 05, 07, 08)
- [ ] 10a Ticket data model, lanes and the create-ticket function (after 02)
- [ ] 10b Direct-message rule: matrix, creation function, legacy chats (after 02)
- [ ] 11 Ticket permissions, status function and automatic status (after 10a)
- [ ] 12 Tickets tab placement and role-correct ticket UI (after 10b, 11)
- [ ] 13 Ticket handler assignment (after 05, 11, 12)
- [ ] 14 Escalate a ticket to the Super Admin and send it back (after 11, 12)
- [ ] 15 Reopen limit and linked follow-up ticket (after 11, 12)
- [ ] 16 Ticket notifications and the Tickets-tab badge (after 13, 14, 15)
- [ ] 17 Request-user-deletion ticket (after 07, 10a, 12)
- [ ] 18 Super Admin review summary on a deletion request (after 17, 19)
- [ ] 19 Suspend and reactivate a user (after 07)
- [ ] 20 Decision actions on a deletion request: Delete, Suspend, Decline (after 07, 16, 18, 19)

## Open questions for the user
See spec section 8: there are **no open decisions** left; everything in rounds one to three is decided and the accepted defaults are listed there. The two reference matrices (Direct messages, ticket visibility) are at the top of `spec.md`.
