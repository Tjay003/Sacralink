# 03: Volunteer dashboard cleanup, personal-only sacrament appointments, and parish/QR edit restrictions

Type: task
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

**What to build:** Align the `volunteer` role across Dashboard, Appointments, and Parish Details with the client's exact operational boundaries:

1. **Volunteer Dashboard cleanup**: Remove the `"Recent sacrament requests"` (`RecentAppointmentsWidget`) component from the Volunteer Dashboard so Volunteers only see their Liturgical Header, Live Broadcast & Virtual Sanctuary Manager, Parish Announcements & Bulletin Board, and Daily Scripture Verse (with Recent Activity and AI Parish Assistant remaining excluded).
2. **Volunteers book and view personal appointments like a normal Parishioner**: On `/appointments` and `/churches/:id`, treat `volunteer` like a normal `user` (Parishioner) rather than parish appointment staff:
   - Scope `/appointments` for a Volunteer strictly to their own personal bookings (`userId = profile.id`), never loading parish-wide sacrament requests.
   - Show the `"Book Appointment"` CTA to Volunteers on `/appointments` and `/churches/:id` so they can apply for sacraments just like a normal user.
   - Ensure Volunteers cannot approve, reject, reschedule, cancel, or edit any appointment records.
3. **Block Volunteers from editing Parish Details or Donation QR codes**:
   - Remove `volunteer` from `canManage` on `/churches` so the `"Edit"` button never appears on parish cards/rows for Volunteers.
   - Add an explicit role guard on `/churches/:id/edit` so if a Volunteer navigates directly to the edit URL, they are redirected back to `/churches/:id` and can never modify parish details or GCash/Maya QR codes.

- [ ] `VolunteerDashboard` renders Liturgical Header, Live Broadcast Manager, Parish Announcements, and Daily Verse, and does NOT render `RecentAppointmentsWidget` ("Recent sacrament requests"), `RecentActivityWidget`, or `AI parish assistant`.
- [ ] On `/appointments`, a Volunteer sees the `"Book Appointment"` button and only their own personal sacrament appointments (`user_id = profile.id`), with no parish-wide appointment requests and no staff edit/approve/reject controls.
- [ ] On `/churches`, a Volunteer does not see the `"Edit"` button on any parish, and visiting `/churches/:id/edit` redirects the Volunteer away without exposing the parish details or QR code editor.
- [ ] E2E test covers Volunteer dashboard widgets, Volunteer personal appointment booking/viewing on `/appointments`, and blocked access to `/churches/:id/edit`.
- [ ] Typecheck and build stay green.
