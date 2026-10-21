# Issue 13: Mobile Parity for Celebrant Badge and Parish Clergy Roster

Type: feature
Status: needs-triage
Blocked by: 12, 03, 04

---

## 1. Description
Follow-up to tickets 03 and 04, deliberately deferred ("web first, mobile soon").

- Show the presiding priest on Mass schedule rows in the mobile church screen (`mobile/app/church/[id].tsx`, data from `mobile/src/lib/supabase/churches.ts`).
- Add a Parish Clergy section using the same `get_parish_clergy` RPC from ticket 12, so logged-out and logged-in users see only name, title, designation and status.
- Mobile has no booking recommender today, so ticket 05 has no mobile counterpart. Note the 052 appointments lockdown still pending on production already breaks mobile appointment writes (accepted in the appointment-editing spec); do not widen that.

Mobile has no local e2e suite equivalent to `web/e2e-local`; decide the verification approach when this is triaged.

---

## 2. Acceptance Criteria
- [ ] Mobile church screen shows the celebrant on Mass schedules when assigned.
- [ ] Mobile church screen shows the clergy roster from the RPC, with no leave reasons.
- [ ] Existing mobile church screen behavior is unchanged for parishes with no priests.
