# Map: Client Concerns (Oct 22)

Spec: `spec.md` · ADR: `docs/adr/0002-messaging-and-ticket-privacy-rls.md`

## Notes
- Build and test on `main`. Never test backend migrations against the production Supabase in `web/.env`; use local Docker Supabase (`web/e2e-local`).
- Simplifying `UserDashboard` and `PriestDashboard` is deferred to a later effort.

## Decisions so far
- **Strict 1-on-1 DM Privacy + Claimed Tickets**: 1-on-1 DMs are visible strictly to their two participants (no `super_admin` or `church_admin` eavesdropping). Parish Office Tickets are visible to the requester and the target parish's staff (`church_admin` and `volunteer`).
- **Logout/Login Leak Fix**: Clear `sacralink_local_ministry_convs` and `sacralink_local_ministry_messages_*` from `localStorage`/`sessionStorage` on `signOut()`, scope local fallback reads/writes by `user.id`, and filter `getOrCreateChurchStaffChannel` strictly to staff roles (`church_admin`, `priest`, `volunteer`).
- **Volunteer Messaging Scope**: Volunteers can participate in their parish's Staff Channel, triage/reply to incoming Parish Office Tickets (`in_progress` / `resolved`), and DM their own parish's staff, but cannot cold-DM parishioners or priests directly.
- **Volunteer Dashboard, Appointments & Parish Details**: Remove `RecentAppointmentsWidget` ("Recent sacrament requests") from `VolunteerDashboard`; treat Volunteers strictly like normal Parishioners for Sacrament Appointments (book and view only their own personal bookings on `/appointments` and `/churches/:id`, zero access to parish-wide appointments or status edits); block Volunteers from editing parish details or QR codes (`/churches` and `/churches/:id/edit`).
- **Zero-Horizontal-Scroll Tables**: Remove `overflow-x-auto` and `min-w-[...]` from `/appointments` and `/users`. Use 4 fluid multi-line stacked columns on Desktop (`lg+`) and responsive 1- or 2-column cards on Tablet/Mobile (`< lg`).
- **Branding, Donations, Coordinates & Forgot Password**: Top-left sidebar subtitle reads `"Parishes of San Jose del Monte"`, remove `"Manage the five parishes of the Diocese of San Jose del Monte"` on `/churches`, enforce numeric-only input on Donation amount, hide raw `📍 lat, lng` badge on `/churches/:id` for `user`/`volunteer` roles, and add `/forgot-password` + `/reset-password` pages wired to Supabase Auth.

## Tasks
- [ ] 01 Branding text updates, numeric-only donation amount input, and hiding raw coordinates for parishioners/volunteers. Blocked by: none
- [ ] 02 Forgot password and reset password flow (`/forgot-password` and `/reset-password`). Blocked by: none
- [ ] 03 Volunteer dashboard cleanup, personal-only sacrament appointments, and parish/QR edit restrictions. Blocked by: none
- [ ] 04 Zero-horizontal-scroll responsive layouts for Appointments table and Users directory. Blocked by: 03
- [ ] 05 Messaging and Parish Office Ticket privacy RLS, Staff Channel role filtering, and logout cache cleanup. Blocked by: none
- [ ] 06 Complete Parish Office Tickets lifecycle, Volunteer messaging scope, info panel cleanup, and live sidebar badges. Blocked by: 05
