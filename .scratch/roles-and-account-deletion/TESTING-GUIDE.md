# Testing guide: roles, account deletion and tickets

For Tyrone, to run by hand after the tickets are built. It is not a spec copy: it says what to click and what you should see. Tick a box when a scenario passes. Each scenario names the ticket that delivers it (see `map.md`), so you can test as tickets ship and skip the rest.

Everything here runs on the **local** Docker database. Never test this on production.

## 0. Getting the local app running

1. Docker Desktop running. From the repo root: `npx supabase start`, then `powershell -File scripts/local-db-setup.ps1 -Reset` (rebuilds the schema; apply any new migrations the same way).
2. Seed the standard users once by running any local spec, for example `cd web; npx playwright test -c playwright.local.config.ts e2e-local/<any>.spec.ts`. The setup file creates the two parishes and one user per role.
3. Start the app against the local database: `cd web; npx vite --mode e2e --port 5174` and open [**http://localhost:5174**](http://localhost:5174). Do not use localhost:5173: that one talks to production.
4. Studio (tables, SQL editor) is at [http://127.0.0.1:54323](http://127.0.0.1:54323) and the email inbox at [http://127.0.0.1:54324](http://127.0.0.1:54324).
5. Use **two browser windows** for the "signed in at the same time" scenarios: one normal window and one private window, so two different people stay logged in.

## 1. The messaging model in plain English

There are five kinds of people: **Parishioner**, **Volunteer**, **Priest**, **Church Admin** (runs one church) and **Super Admin** (one shared account for the whole platform; the Admin role no longer exists).

There are three ways to talk:

- **Direct chat**: one person to one person. Only some pairs may *start* one. The other person can always reply.
- **Staff channel**: the group chat of one church's staff. Volunteers and Priests use it to talk to each other and to their Church Admin.
- **Ticket**: a formal request that somebody must answer, with a number (TCK-000123), a category and a status (Open, In Progress, Resolved, Closed).

```
                       reports a concern about the church
   Parishioner ───────────────────────────────────────────────────┐
        │  ticket (church lane)                                    ▼
        ▼                                                    ┌────────────┐
   Church Admin ──── assigns ───▶ Priest / Volunteer         │ Super Admin│
        │                              │                     └────────────┘
        └──── escalates ───────────────┘ (assignee may escalate)   ▲  │
                      │                                            │  │ send back
                      └────────────────────────────────────────────┘  ▼ (with a note)
                                                              back to the Church Admin
   Church staff (Church Admin / Priest / Volunteer) ── platform ticket ──▶ Super Admin
```

**Who can start a Direct chat** (the other person can always reply):


| Starts the chat | Parishioner                        | Volunteer       | Priest          | Church Admin    | Super Admin |
| --------------- | ---------------------------------- | --------------- | --------------- | --------------- | ----------- |
| Parishioner     | no                                 | no              | no              | no              | no          |
| Volunteer       | no                                 | no              | no              | no              | no          |
| Priest          | only one who shares an appointment | no              | no              | own church only | no          |
| Church Admin    | own church only                    | own church only | own church only | any church      | yes         |
| Super Admin     | no                                 | no              | no              | any church      | n/a         |


"No" means: use a ticket (Parishioner) or the staff channel / a platform ticket (staff). Old chats that the table no longer allows stay readable; Parishioners and Volunteers can't write in them any more (banner "Please open a ticket").

**Ticket privacy** (this is the part to look at carefully):


| Ticket                                            | Who sees it                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parishioner's ticket to the church                | the Parishioner and that church's Church Admin(s). The Super Admin does **not**. Priests and Volunteers do **not**, unless the Church Admin assigns it to them.                       |
| Same ticket after escalation                      | the Parishioner and the Super Admin only. The Church Admin sees just a one-line stub ("TCK-123 · Escalated to Super Admin" with the date, cannot open it). The assignee sees nothing. |
| Same ticket after "send back"                     | back to the Parishioner and the Church Admin; the Super Admin loses it. It can't be escalated again.                                                                                  |
| Staff member's platform ticket to the Super Admin | the staff member and the Super Admin only. **Not even their own Church Admin.**                                                                                                       |
| Parishioner's "Report a concern about my church"  | the Parishioner and the Super Admin only; that church's Church Admin can't see it.                                                                                                    |


Limits: at most **3** open platform tickets per person (deletion requests not counted), **5** open deletion requests per Church Admin, **2** open concerns per Parishioner.

## 2. Test accounts

All passwords are `LocalTest#123`. Short names are used below.


| Short name   | Email                                                     | Role / church                               | Already seeded?                                                 |
| ------------ | --------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| ADMIN        | [admin@local.test](mailto:admin@local.test)               | Church Admin, Local Test Parish             | yes                                                             |
| OTHER-ADMIN  | [other-admin@local.test](mailto:other-admin@local.test)   | Church Admin, Other Test Parish             | yes                                                             |
| PRIEST       | [priest@local.test](mailto:priest@local.test)             | Priest                                      | yes (check its church in the Users page; use Local Test Parish) |
| PRIEST2      | [priest2@local.test](mailto:priest2@local.test)           | second Priest                               | yes                                                             |
| PARISHIONER  | [parishioner@local.test](mailto:parishioner@local.test)   | Parishioner, home church Local Test Parish  | yes (set the home church if empty)                              |
| ADMIN2       | [admin2@local.test](mailto:admin2@local.test)             | second Church Admin, Local Test Parish      | **create**                                                      |
| VOLUNTEER    | [volunteer@local.test](mailto:volunteer@local.test)       | Volunteer, Local Test Parish                | **create**                                                      |
| PARISHIONER2 | [parishioner2@local.test](mailto:parishioner2@local.test) | Parishioner, home church Other Test Parish  | **create**                                                      |
| SUPER        | [super@local.test](mailto:super@local.test)               | Super Admin (no church; only one can exist) | **create**                                                      |
| EMPTY        | "Empty Test Parish"                                       | a church with no Church Admin               | **create**                                                      |


To create an account: Studio, Authentication, Add user (tick auto-confirm, password above); then in the SQL editor:

```sql
update public.profiles
   set role = 'volunteer',            -- or church_admin / super_admin / user
       assigned_church_id = (select id from public.churches where name = 'Local Test Parish')
 where email = 'volunteer@local.test';
```

For EMPTY: `insert into public.churches (name, address, status) values ('Empty Test Parish', '1 Test Street', 'active');`.

To make an appointment between PRIEST and PARISHIONER (needed for the Direct-message tests), book one as PARISHIONER and approve it as ADMIN with PRIEST as celebrant.

To make a ticket "seven days old": in the SQL editor, `update public.conversations set created_at = now() - interval '8 days' where ticket_number = 'TCK-000123';`.

---

## 3. Scenarios

### A. Small cleanups

- [x] **A1 · Large Text mode is gone** (ticket 01). Log in as ADMIN, then PARISHIONER. *Expect:* no "Large text mode" switch at the bottom of the sidebar, and pages look normal at the usual text size. *Blocked:* none; also check the page at phone width.
- [x] **A2 · No Admin role anywhere** (tickets 02, 03). Before applying ticket 02, make a throwaway user with role `admin` in Studio. After 02: that user is now a Parishioner. As SUPER, open Users: the role filter and the edit-role picker have no "Admin" or "Diocese Admin"; Messages has no "Diocese Admin/Office" labels. *Blocked:* trying `update profiles set role = 'admin'` in Studio is rejected.
- [x] **A3 · Ownership transfer** (ticket 02). As SUPER use Transfer Ownership to hand the Super Admin role to another user. *Expect:* the old owner becomes a **Parishioner** (not an Admin). Undo it in Studio afterwards.
- [x] **A4 · Admin leftovers in the database** (ticket 04, last, only after 052 is in production). Nothing to click: the full local suite stays green and no policy mentions `admin`.

### B. Changing roles

- [x] **B1 · Church Admin promotes a Parishioner to Volunteer** (tickets 05, 06). As ADMIN open Users and edit PARISHIONER (a Parishioner of Local Test Parish). The role picker shows exactly four roles (Parishioner, Volunteer, Priest, Church Admin) and **no church picker**. Set Volunteer. *Expect:* PARISHIONER is now a Volunteer of Local Test Parish and, when logged in, sees the volunteer menus.
- [x] **B2 · Church Admin promotes someone to Church Admin** (05, 06). Make VOLUNTEER a Church Admin. *Expect:* it works; they get Church Admin pages.
- [x] **B3 · Demotion** (05, 06). As ADMIN demote ADMIN2 (needs two Church Admins). *Expect:* the confirmation says the person becomes a Parishioner, stays in the church, loses staff access, leaves the staff channel, and tickets assigned to them return to the Church Admin. After confirming, ADMIN2 is a Parishioner of Local Test Parish (still listed in that church) and sees no staff menus.
- [x] **B4 · Last Church Admin guard** (05, 06). With ADMIN and ADMIN2 both Church Admins: ADMIN2 demotes ADMIN (works). Now log in as ADMIN2 and try to demote yourself or the only other admin. *Expect (blocked):* no demote option on your own row, and the readable message "A church must keep at least one Church Admin" if you try to remove the last one.
- [x] **B5 · Limits of a Church Admin** (05, 06). *Blocked:* ADMIN cannot see or edit users of Other Test Parish, cannot choose Super Admin, and cannot change their own role.
- [x] **B6 · Super Admin can set any role anywhere** (05, 06). As SUPER, change roles in both churches using the church picker. *Blocked:* there is no way to create a second Super Admin.
- [x] **B7 · Staff channel on demotion** (05). VOLUNTEER can open Messages, Staff tab, and see the Local Test Parish channel. ADMIN demotes VOLUNTEER. *Expect:* VOLUNTEER no longer sees that channel. Promoting a Volunteer to Priest in the same church does **not** remove them from it.

### C. Deleting, suspending and cutting people off

- [x] **C1 · Super Admin deletes a user** (ticket 07). Give PARISHIONER2 an appointment or a donation first. As SUPER open Users, Delete on PARISHIONER2: the dialog lists what happens and asks you to type the email. *Expect:* afterwards PARISHIONER2 cannot log in, their appointment/donation history is still there, and the same email can sign up again as a new account.
- [x] **C2 · Who can delete** (07). *Blocked:* ADMIN has no Delete button. SUPER cannot delete themselves or another Super Admin.
- [x] **C3 · Immediate cut-off on delete** (07). Window B: log in as PARISHIONER2 and stay on a page. Window A: SUPER deletes PARISHIONER2. *Expect:* within a few seconds, or on the very next click or refresh in window B, PARISHIONER2 is signed out and cannot do anything. They do **not** get to keep working until some timer expires.
- [x] **C4 · "Deleted User" display** (ticket 08). As ADMIN look at the appointments list, donations list and an old chat message from the deleted person. *Expect:* the name shows "Deleted User" with a small danger icon; hovering says "Deleted user". Never a blank name, "null" or the old email.
- [x] **C5 · Cannot message a deleted or suspended user** (tickets 07, 12, 19). Open an old Direct chat with the deleted person. *Expect:* history readable, composer disabled with "This user is no longer available". The same after a suspend (C8).
- [x] **C6 · Self-delete** (ticket 09). As PARISHIONER open Profile, "Delete my account", read the warning, type the email. *Expect:* you are signed out at once and cannot log back in; the history stays and shows "Deleted User".
- [x] **C7 · Self-delete is blocked when it should be** (09). *Blocked, with a clear message and nothing changed:* the last Church Admin of a church; a Priest who has an upcoming **approved** appointment. SUPER sees no "Delete my account" section at all.
- [x] **C8 · Open tickets close when the requester is deleted** (07, needs a ticket from E1). The deleted person's open ticket becomes Closed with a system note, so nobody waits on it.
- [x] **C9 · Suspend, then reactivate** (ticket 19). Window B: VOLUNTEER signed in. Window A: SUPER suspends VOLUNTEER (reason required). *Expect:* window B is cut off immediately (signed out on the next click, shows the suspended message); a fresh login says "This account is suspended"; their role, church and history are untouched and the Users list shows a Suspended badge. Reactivate: login works again with the same role.
- [x] **C10 · Who can suspend** (19). *Blocked:* ADMIN has no Suspend action (only sees the badge); nobody can suspend SUPER, themselves or a deleted user.
- [x] **C11 · Normal people are not affected** (07, 19). After these tickets land, log in as each role and click through Dashboard, Appointments, Donations, Messages and Notifications. *Expect:* everything works as before. (The block applies to every table, so this check matters.)

### D. Direct messages

- [x] **D1 · Parishioner has no Direct contacts** (tickets 10b, 12). As PARISHIONER click New Message. *Expect:* no people to pick; you are offered **New Ticket** instead. *Blocked:* there is no way to start a chat with the Church Admin, a Priest or the Super Admin.
- [x] **D2 · Volunteer has no Direct contacts** (10b, 12). As VOLUNTEER click New Message. *Expect:* no people; you are offered the staff channel and New Ticket.
- [x] **D3 · Priest's contacts** (10b, 12). As PRIEST New Message lists: parishioners who share an appointment with PRIEST, and Church Admins of PRIEST's own church. *Blocked/absent:* Volunteers, PRIEST2, the Super Admin, OTHER-ADMIN, parishioners without a shared appointment.
- [x] **D4 · Church Admin's contacts** (10b, 12). As ADMIN New Message lists: SUPER, every Church Admin (including OTHER-ADMIN), and the Parishioners, Priests and Volunteers of Local Test Parish. *Absent:* people of Other Test Parish who are not Church Admins.
- [x] **D5 · Super Admin's contacts** (10b, 12). As SUPER New Message lists Church Admins of any church, and nobody else.
- [x] **D6 · Both directions work** (10b). ADMIN starts a chat with SUPER; SUPER replies; and the other way round. ADMIN starts a chat with PARISHIONER; PARISHIONER **can reply** (the recipient can always reply).
- [x] **D7 · Old chats are read-only for Parishioners and Volunteers** (10b, 12). Before applying these tickets, create old chats: PARISHIONER to ADMIN, VOLUNTEER to ADMIN, ADMIN to ADMIN2, ADMIN to SUPER. After: PARISHIONER and VOLUNTEER still read the history but see the banner **"Please open a ticket"** with a New Ticket button and no composer. ADMIN can still reply in those chats. The ADMIN to ADMIN2 and ADMIN to SUPER chats are completely normal. *Blocked:* a REST call posting as PARISHIONER into the old chat is rejected (covered by the automatic tests).

### E. Tickets

- [x] **E1 · Parishioner raises a church ticket** (tickets 10a, 12). As PARISHIONER New Ticket, pick Local Test Parish, a category, subject (3+ characters), message (10+). *Expect:* a ticket number TCK-xxxxxx under the **Tickets** tab. ADMIN sees it. *Blocked:* PRIEST, VOLUNTEER, OTHER-ADMIN and SUPER do **not** see it anywhere (list, bell, search).
- [x] **E2 · Tickets only under Tickets** (ticket 12). Direct chats, staff channels and ministry groups never appear under Tickets, and tickets never appear under All or Direct.
- [x] **E3 · Church without a Church Admin** (10a, 12). As PARISHIONER start New Ticket and pick Empty Test Parish. *Expect:* "This church has no administrator yet" and only the "Report a concern about my church" route. *Blocked:* a normal church ticket to that church.
- [ ] **E4 · Concern about my church** (10a). As PARISHIONER raise "Report a concern about my church". *Expect:* SUPER sees it; ADMIN of that church does **not**. The limit is 2: the third open one is refused with a clear message. It has no "send back" for SUPER (see E15). *Blocked:* PARISHIONER sees no other platform category.
- [x] **E5 · Categories per role on the platform lane** (10a). ADMIN offers: General Question, Request user deletion, Church verification and setup, Report a problem, Report a person or abuse. PRIEST and VOLUNTEER offer only General Question, Report a problem, Report a person or abuse. A VOLUNTEER is first asked "Parish office" or "Super Admin". *Blocked:* PRIEST and VOLUNTEER cannot file Request user deletion or Church verification and setup.
- [x] **E6 · Platform ticket is private from the church** (10a, 11). PRIEST raises a Report a problem. *Expect:* only PRIEST and SUPER see it. ADMIN of the same church does **not**. Same for a Volunteer's.
- [x] **E7 · Limits** (10a, 17). As ADMIN raise 3 platform tickets (not deletion requests): the 4th is refused with a clear message; SUPER resolves one and ADMIN can raise another. Deletion requests have their own limit of 5 (F1) and don't use up the 3.
- [x] **E8 · Status dropdown only for the handler** (tickets 11, 12). On a church ticket ADMIN gets the status dropdown. PARISHIONER, and a VOLUNTEER who raised the ticket, see a read-only badge. On a platform ticket SUPER gets the dropdown. *Blocked:* a requester cannot change their own ticket's status.
- [x] **E9 · Automatic status** (11). ADMIN's first reply moves Open to In Progress. Set it to Resolved; PARISHIONER replies; it goes back to Open. Replies on In Progress change nothing.
- [ ] **E10 · Closed tickets and the reopen limit** (ticket 15). ADMIN sets Closed: nobody can post. PARISHIONER reopens it (1st), ADMIN closes, PARISHIONER reopens (2nd), ADMIN closes. *Expect (blocked):* the 3rd reopen is refused ("reopen limit") and the button becomes **Raise a new ticket**, which creates a ticket showing "Follow-up to TCK-…". ADMIN can always reopen, no limit.
- [x] **E11 · Assignment gives access** (ticket 13). ADMIN assigns the E1 ticket to PRIEST. *Expect:* PRIEST now sees it (list, bell), can reply and change status; PRIEST2 and VOLUNTEER still cannot see it; PARISHIONER sees "Assigned to PRIEST". ADMIN unassigns: PRIEST loses it at once. *Blocked:* assigning to a Parishioner, to the requester or to someone from another church; a Priest/Volunteer has no Assign button.
- [x] **E12 · Demotion returns assigned tickets** (13, 05). Assign a ticket to VOLUNTEER, then demote VOLUNTEER (B3). *Expect:* the ticket is unassigned with a system note and is back with ADMIN. VOLUNTEER's own platform ticket to SUPER stays open for SUPER.
- [x] **E13 · Escalation and the stub** (tickets 14, 12). ADMIN escalates a ticket (reason required). *Expect:* SUPER sees it and can reply and change status; PARISHIONER still sees it with the escalation note; **ADMIN sees only a grey line "TCK-… · Escalated to Super Admin" with the date, which cannot be opened**; an assigned PRIEST sees nothing at all. *Blocked:* ADMIN cannot read or reply to it any more; no notification reaches ADMIN or the old assignee.
- [x] **E14 · An assignee can escalate** (14). Assign to PRIEST; PRIEST escalates (a warning says they will lose sight of it). *Expect:* PRIEST no longer sees it; ADMIN sees the stub.
- [x] **E15 · Send back** (14). SUPER sends back (a) an escalated church ticket and (b) a PRIEST's General Question or Report a problem, each with a note of 10+ characters. *Expect:* ADMIN sees the full ticket again and is its handler; SUPER no longer sees it; it cannot be escalated again. *Blocked:* no Send back button on a Report a person or abuse ticket, on a Parishioner's "concern about my church", or on tickets a Church Admin raised.
- [x] **E16 · Ask the Super Admin to review** (14, 12). Make an unanswered ticket 8 days old (see section 2). As PARISHIONER the button **Ask the Super Admin to review** appears; using it escalates the ticket (note in the thread). *Blocked / not shown:* before 7 days; after any reply from the church; on a closed ticket; after it was sent back; for anyone but the requester.
- [x] **E17 · Notifications and the badge** (ticket 16). Check the bell and the unread number on the Tickets tab for: new ticket (Church Admin or Super Admin), assignment (assignee), reply from the other side, status change (requester), escalation (SUPER and requester), reopen. *Expect:* nobody is notified of their own action; repeated replies collapse into one unread notification; clicking opens the ticket on the Tickets tab. *Blocked:* people who cannot see a ticket get no notification for it (ADMIN and the old assignee after escalation; ADMIN for a staff member's platform ticket); ADMIN is notified again only on a send back.
- [x] **E18 · Changing home church** (10a). Change PARISHIONER's home church from Local to Other Test Parish after raising a ticket. *Expect:* the old ticket stays with Local's ADMIN until closed; a new ticket goes to OTHER-ADMIN.

### F. Asking for a user to be deleted

- [x] **F1 · Church Admin files a deletion request** (ticket 17). ADMIN: New Ticket, Request user deletion, pick a user of Local Test Parish, reason of 20+ characters (also available as "Request deletion" on the Users page row). *Expect:* SUPER receives a ticket naming that person. *Blocked:* a user of another church, yourself, SUPER; a duplicate open request for the same user; a 6th open request from the same Church Admin; PRIEST and VOLUNTEER cannot file this type. ADMIN cannot delete or suspend directly.
- [x] **F2 · Review summary** (ticket 18). As SUPER open the request. *Expect:* a Review panel with last sign-in, joined date, role, church, counts (appointments, donations, messages, tickets) and the last 10 recorded activities (it may say "No recorded activity yet"). ADMIN does not see this panel. A "Report a person or abuse" ticket that names a person shows the same panel (but no Delete/Suspend buttons).
- [x] **F3 · Three decisions** (ticket 20). SUPER can **Delete** (anonymized, ticket resolved), **Suspend** (cannot sign in, ticket stays In Progress, can still Delete/Decline later) or **Decline** (note back to ADMIN, ticket closed, user untouched). *Expect:* ADMIN gets the status and the note. *Blocked:* ADMIN cannot press any of them.

### G. Final sweep

- [x] **G1 · Wording** (already shipped, check once). No "Diocese" or "Chancery" on the pages you used; the sidebar group reads Management, with Churches and Church Applications; stat cards say Pending Requests and Services Completed.
- [x] **G2 · Phone width** (tickets 12 and 16). Tickets, Users and Messages pages at phone width: no horizontal scrolling, nothing overlapping.
- [x] **G3 · Everyone can still sign in and out** after all tickets ship, including a user who was suspended and reactivated.