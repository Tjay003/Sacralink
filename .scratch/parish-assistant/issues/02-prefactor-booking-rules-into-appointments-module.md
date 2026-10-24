# 02: Prefactor: booking rules out of the booking page

Type: task
**Status:** ready-for-agent
**Blocked by:** None (can start immediately)

**What to build:** "make the change easy". Today the rules for whether a Booking may be submitted live inside the booking page. Those rules are: every required document attached, the slot free with an eligible priest, the date in the future, and the requested priest stored as a preference and never as the Celebrant. Move them into the Appointments module as plain functions that take the Booking's values and return either "ok" or a list of plain-language problems. The booking page calls them instead of its inline checks. A Parishioner sees no difference. This lets the Booking Guide (ticket 06) enforce exactly the same rules without copying them.

- [ ] The submit-time checks (required documents, slot and eligible priest, future date) are exposed from the Appointments module and used by the booking page
- [ ] Error messages shown on the booking page are unchanged
- [ ] No behaviour change: the existing booking e2e specs (priest request, celebrant pool, availability) pass unchanged
- [ ] `tsc -b` and lint are clean
