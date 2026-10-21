# Specification: Client Concerns — UI Polish, Messaging & Tickets Privacy, Volunteer Scope, and Password Recovery

Status: ready-for-agent
Source: grill-with-docs session, 2026-10-22
Glossary: Parish / Church, Parishioner, Volunteer, Church Admin, Super Admin, Direct Message, Parish Office Ticket, Staff Channel, Appointment / Booking, Donation (see `CONTEXT.md`)
ADR: `docs/adr/0002-messaging-and-ticket-privacy-rls.md`

---

## Problem Statement

During client review of SacraLink, several usability, role-boundary, and privacy issues surfaced:
1. **Horizontal Scroll on Data Tables**: Both the Appointments table and the Users directory table force horizontal scrolling on standard desktop and laptop viewports when the sidebar is open.
2. **Messaging & Ticket Incomplete Workflows and Privacy Leaks**:
   - Logging out and logging into another account on the same browser leaks cached conversations from the previous account, regular parishioners with a `church_id` were auto-added to the Parish Staff Channel, and admin RLS policies allowed viewing private 1-on-1 Direct Messages of other users.
   - Parishioners cannot open a new Parish Office Ticket directly from `/messages`, closed tickets do not lock the message composer or offer a reopen flow, the sidebar shows hardcoded notification badges (`2` and `12`), and the right-hand info panel displays a hardcoded `'Baptism · Nov 11, 2026'` placeholder.
3. **Volunteer Over-Privileging**: Volunteers can still see an Edit button on the Parishes list and access the Parish edit page (including QR code settings), see parish-wide sacrament requests on their dashboard and `/appointments` page instead of booking personal appointments like a normal Parishioner, and lack clear boundaries in Messaging.
4. **Branding, Donations Input, Coordinates Visibility & Password Recovery**:
   - The Parishes page displays a Diocese management subtitle that should be removed, and the top-left sidebar subtitle still says `"Diocese of San Jose del Monte"` instead of `"Parishes of San Jose del Monte"`.
   - The Donation amount input allows typing non-numeric text characters.
   - Raw GPS coordinates (`📍 lat, lng`) are exposed on the Church Details map to Parishioners and Volunteers.
   - Clicking `"Forgot password?"` on the Login page routes to `/forgot-password`, which has no implemented page or route.

## Solution

1. **Zero-Horizontal-Scroll Responsive Layouts**: Redesign the Appointments table and Users directory table so Desktop (`lg+`) uses a fluid, multi-line stacked column layout (`table-fixed` / wrapping cells with zero `overflow-x-auto`) and Tablet/Mobile (`< lg`) uses clean 1- or 2-column responsive cards.
2. **Strict Messaging & Ticket Privacy + Complete Ticket Lifecycle**:
   - Purge local/session conversation caches on logout, restrict Staff Channel auto-enrollment strictly to parish staff (`church_admin`, `priest`, `volunteer`), and tighten RLS so 1-on-1 Direct Messages are strictly private to their two participants and Parish Office Tickets are scoped to the requester and assigned parish staff.
   - Scope Volunteers in Messaging to their parish's Staff Channel, incoming Parish Office Tickets (triage/reply), and DMs with their own parish's staff (no cold DMs to parishioners or priests).
   - Add a "New Parish Office Ticket" modal trigger directly on `/messages`, enforce the `closed` ticket state (locked composer + "Reopen Ticket" action) with status filter pills under the Tickets tab, wire live unread/pending counts into the sidebar badges, and remove hardcoded appointment placeholders from the conversation info panel.
3. **Volunteer Role Boundaries**:
   - Remove `RecentAppointmentsWidget` ("Recent sacrament requests") from the Volunteer Dashboard so only the Liturgical Header, Live Broadcast Manager, Parish Announcements, and Daily Verse remain.
   - Treat Volunteers strictly like Parishioners (`user`) for Sacrament Appointments: on `/appointments` and `/churches/:id`, Volunteers book and view only their own personal appointments with zero access to parish-wide requests or appointment edits.
   - Remove `volunteer` from parish edit permissions on `/churches` and guard `/churches/:id/edit` so Volunteers can never edit parish details or QR codes.
4. **Branding, Numeric Donations Input, Coordinates Visibility & Forgot Password**:
   - Remove `"Manage the five parishes of the Diocese of San Jose del Monte"` from the Parishes page header and update the sidebar brand subtitle to `"Parishes of San Jose del Monte"`.
   - Enforce strict numeric-only input on the Donation amount field.
   - Hide the raw `📍 lat, lng` coordinate overlay badge on Church Details for `user` and `volunteer` roles while keeping the interactive map and `"Open in OpenStreetMap"` button.
   - Implement `/forgot-password` and `/reset-password` pages wired to Supabase Auth (`resetPasswordForEmail` and `updateUser`).

## User Stories

1. As a Church Admin or Super Admin viewing the Appointments page on any screen size, I want all appointment details and actions to fit within the viewport without horizontal scrolling, so that I can review and act on bookings without panning sideways.
2. As a Super Admin or Church Admin viewing the Users directory on any screen size, I want user profiles, roles, assigned parishes, and actions to fit without horizontal scrolling, so that I can manage accounts comfortably on laptops, tablets, and phones.
3. As a Parishioner or Priest sending a 1-on-1 Direct Message, I want my conversation to be strictly visible only to me and the recipient, so that personal and pastoral communications remain confidential even from Church Admins and Super Admins.
4. As a user logging out of SacraLink on a shared browser and logging in as a different user, I want all cached conversation state cleared on sign-out, so that the next user never sees my chat history.
5. As a Parishioner assigned to a home parish, I want to be excluded from the parish's internal Staff Channel, so that internal staff discussions are never exposed to parishioners.
6. As a Parishioner or Volunteer on `/messages`, I want to open a new Parish Office Ticket by selecting a parish, category, and subject directly from the Messages page, so that I do not have to navigate to the parish detail page first.
7. As a Parishioner or Parish Staff member viewing a `closed` Parish Office Ticket, I want the message composer locked with a clear option to reopen the ticket, so that resolved/closed inquiries have a clear lifecycle.
8. As a Church Admin or Volunteer triaging Parish Office Tickets, I want to filter tickets by status (`All`, `Open`, `In Progress`, `Resolved`, `Closed`), so that I can focus on unanswered inquiries first.
9. As a Volunteer on `/messages`, I want to chat in my parish's Staff Channel, triage and reply to incoming Parish Office Tickets for my parish, and message my parish's Church Admin/Staff, while being prevented from cold-DMing parishioners or priests directly.
10. As any authenticated user, I want the sidebar badges on Appointments and Messages to reflect real pending/unread counts from the database (and hide when zero), so that I am not misled by hardcoded numbers.
11. As a user inspecting the right-hand conversation details panel on `/messages`, I want to see only real linked appointment or ticket metadata without a fake `'Baptism · Nov 11, 2026'` placeholder.
12. As a Volunteer viewing my Dashboard, I want to see only my Liturgical Header, Live Broadcast Manager, Parish Announcements, and Daily Verse (without Recent Sacrament Requests, Recent Activity, or AI Parish Assistant), so that my workspace is focused strictly on volunteer duties.
13. As a Volunteer visiting `/appointments` or a Parish page, I want to book sacrament appointments for myself and view only my own personal bookings just like a Parishioner, without seeing or editing other parishioners' appointments.
14. As a Volunteer browsing `/churches` or `/churches/:id`, I want no access to edit parish details or change donation QR codes, so that sensitive parish configuration remains restricted to Church Admins and Super Admins.
15. As a user viewing the sidebar header and `/churches` page, I want the top-left brand subtitle to read `"Parishes of San Jose del Monte"` and the `"Manage the five parishes of the Diocese of San Jose del Monte"` subtitle removed from the Parishes tab.
16. As a Parishioner submitting a donation proof, I want the Amount input box to reject letters and invalid characters (`e`, `E`, `+`, `-`), so that I can only enter valid numeric amounts.
17. As a Parishioner or Volunteer viewing a Parish's details page, I want to see the map and `"Open in OpenStreetMap"` link without raw GPS coordinate numbers (`📍 lat, lng`), so that the interface stays clean and non-technical.
18. As a user who forgot my password, I want to request a password reset email from `/forgot-password` and set a new password on `/reset-password`, so that I can recover access to my account.

## Implementation Decisions

- **Messaging & Ticket Privacy Seam (`messaging.ts` + Supabase Migration `057`)**:
  - Replace the `conversations` and `messages` SELECT RLS policies in a new migration so:
    - Direct Messages (`is_ticket = false` and not a `Staff Channel`) are selectable only when `auth.uid()` is in `conversation_participants` for that conversation (no `super_admin` or `church_admin` override).
    - Parish Office Tickets (`is_ticket = true`) are selectable when `auth.uid()` is in `conversation_participants` OR (`auth.uid()` is a `church_admin` or `volunteer` assigned to `conversations.church_id`).
    - Staff Channels are selectable only when `auth.uid()` is a `church_admin`, `priest`, or `volunteer` assigned to `conversations.church_id` (and clean up any existing `conversation_participants` rows in Staff Channels belonging to `role = 'user'`).
  - In the auth sign-out seam, remove `sacralink_local_ministry_convs` and any `sacralink_local_ministry_messages_*` keys from `localStorage` and `sessionStorage`, and scope any local fallback reads/writes by the authenticated `user.id`.
  - In `getOrCreateChurchStaffChannel`, filter the profile lookup with `.in('role', ['church_admin', 'priest', 'volunteer'])` so parishioners are never added.
  - Restrict Volunteer recipient search in `MessagingPage` so Volunteers can only initiate DMs with staff of their assigned parish, while keeping full access to their parish's Staff Channel and Parish Office Tickets.
- **Complete Ticket & Sidebar Badge Flow**:
  - Reuse `ParishInquiryModal` (or extend it with a parish selector when `churchId` is not pre-supplied) so clicking "New Ticket" on `/messages` lets a Parishioner or Volunteer pick a parish, category, subject, and initial message.
  - When a ticket conversation has `ticket_status === 'closed'`, replace the message input bar with a locked banner and a `"Reopen Ticket"` button (which transitions `ticket_status` back to `open` and logs a system message).
  - Add status filter pills (`All`, `Open`, `In Progress`, `Resolved`, `Closed`) to the Tickets tab in `MessagingPage`.
  - Remove the hardcoded `'Baptism · Nov 11, 2026'` fallback from the right-hand info panel in `MessagingPage`.
  - Compute real unread message count and role-appropriate pending appointment count in `DashboardLayout` instead of hardcoded `badge: 12` and `badge: 2`.
- **Volunteer Scope Reduction**:
  - Remove `RecentAppointmentsWidget` from `VolunteerDashboard`.
  - In `AppointmentsPage`, exclude `volunteer` from `isChurchStaff` so Volunteers query `userId: profile.id` (their own personal bookings) and see the `"Book Appointment"` CTA, with zero access to parish-wide appointments or status actions.
  - In `ChurchesPage`, exclude `volunteer` from `canManage`, and in `EditChurchPage` redirect any user whose role is not `super_admin`, `admin`, or `church_admin` back to `/churches/:id`.
- **Responsive Zero-Horizontal-Scroll Tables**:
  - In `AppointmentsPage`, switch the breakpoint from `md` to `lg` for the table view, remove `overflow-x-auto` and `min-w-[800px] lg:min-w-[920px]`, and consolidate the desktop table into 4 fluid multi-line columns: `Sacrament & Parish`, `Parishioner & Candidate`, `Schedule & Celebrant`, and `Status & Actions`. Render the responsive card list below `lg`.
  - In `UsersPage` (Flat Table mode), remove `overflow-x-auto` and consolidate the desktop table (`lg+`) into 4 fluid multi-line columns: `User & Email`, `Role & Assigned Parish`, `Registered`, and `Actions`. Render the responsive 1/2-column card grid below `lg`.
- **Branding, Donations Input, Coordinates & Forgot Password**:
  - Remove `"Manage the five parishes of the Diocese of San Jose del Monte"` from `ChurchesPage`, and update the `DashboardLayout` brand subtitle to `"Parishes of San Jose del Monte"`.
  - In `SubmitDonationModal`, block `e`, `E`, `+`, `-`, and non-digit characters on `onKeyDown` and sanitize `onChange` so only valid numeric amounts (with optional decimal point) can be entered.
  - In `ChurchDetailPage`, render the `📍 lat, lng` badge inside the map preview only when `profile?.role` is `super_admin`, `admin`, `church_admin`, or `priest`.
  - Add `ForgotPasswordPage` (`/forgot-password`) and `ResetPasswordPage` (`/reset-password`) public routes in `App.tsx`, using `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })` and `supabase.auth.updateUser({ password })`.

## Testing Decisions

- **Testing Seams**:
  1. **Local Supabase Database & RLS Seam (`web/e2e-local/`)**: Test the new messaging/ticket RLS migration (`057`) against local Docker Supabase to verify that (a) User A's 1-on-1 DM is invisible to User B, Church Admin, and Super Admin; (b) Parishioners are never enrolled in a Parish Staff Channel; and (c) Parish Office Tickets are visible only to the requester and that parish's staff.
  2. **End-to-End Playwright Seam (`web/e2e/` and `web/e2e-local/`)**: Test external user-visible behaviors in the browser:
     - Viewport overflow checks (`scrollWidth <= clientWidth`) across mobile (`375px`), tablet (`768px`), laptop (`1024px`, `1280px`), and desktop (`1440px`) on `/appointments` and `/users`.
     - Volunteer role E2E verification: Volunteer dashboard widgets, personal appointment booking on `/appointments`, and blocked access to `/churches/:id/edit` and QR settings.
     - Messaging & Ticket lifecycle: creating a ticket from `/messages`, filtering by ticket status, closing and reopening a ticket, and verifying sign-out clears local conversation state.
     - Branding text assertions, numeric-only donation amount input, hidden coordinates for Parishioner/Volunteer on `/churches/:id`, and the `/forgot-password` + `/reset-password` flows.
- **Prior Art**: Existing local RLS and E2E suites in `web/e2e-local/` (`celebrant-eligibility.spec.ts`, `service-types.spec.ts`) and `web/e2e/`.

## Out of Scope

- Simplifying `UserDashboard` and `PriestDashboard` layouts (explicitly deferred to a later effort).
- Mobile app (React Native) parity for these web UI and routing updates.

## Further Notes

- Remember `AGENTS.md`: never test backend migrations against the production Supabase in `web/.env`; always verify migrations against local Docker Supabase first.
