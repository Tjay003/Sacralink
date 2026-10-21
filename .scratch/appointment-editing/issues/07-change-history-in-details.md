# 07: Change history visible to office and celebrant

Type: task
**Blocked by:** 01
**Status:** resolved

**What to build:** The office and the appointment's celebrant can see an appointment's change history: a newest-first list of Appointment Changes (action, reason or note, before → after, who, when). It appears inside the existing appointment details for the office on the appointments page, and inside the celebrant's appointment details on the priest dashboard. Parishioners don't see it. They only see notices and notifications.

See the spec working default on change history visibility.

- [x] The history renders in the office details view and the celebrant details view.
- [x] Parishioners can't read history rows. This is enforced by RLS, not just hidden in the UI.
- [x] An appointment with no edits shows an empty state, not an error.
- [x] The e2e test covers that, after a cancel and a restore, the office sees two entries in order.

## Resolution

- RLS verified, no migration needed. `appointment_changes` (migration 046) has RLS enabled, `REVOKE ALL` from `anon` and `authenticated`, then `GRANT SELECT` to `authenticated` with a single SELECT policy: super admin, admin or church admin of the row's church, or the `priest_id` of the appointment. A parishioner matches none of these and gets zero rows (they would only match as the celebrant of their own appointment). Migrations 047 to 051 do not touch the table's grants or policies (grep confirmed). No INSERT/UPDATE/DELETE policy or grant exists, so writes remain function-only. `profiles` is readable by any authenticated user (migration 032), so names resolve for office and celebrant.
- Web helper: `fetchAppointmentChanges(appointmentId)` in `web/src/lib/supabase/appointments.ts` returns `{ data: AppointmentChange[], error }`, newest first (`created_at desc`), with `changed_by_name` (falls back to "Staff") and `celebrant_names` (profile id to full name for `priest_id` values in before/after). One extra `profiles` query; if it fails the history still loads with fallbacks.
- Component: `web/src/components/appointments/AppointmentChangeHistory.tsx`, props `{ appointmentId, refreshKey?, className? }`. A `<section>` with an `<ol>`: action label, before to after lines (statuses with `completed` shown as "Celebrated", dates/times, celebrant names, "Unassigned"), "Reason:" (or "Note:" for mark celebrated), actor and time. Loading, "No changes yet" and a calm error state with "Try again".
- Placement: inside `EditAppointmentModal` (the office's appointment details view; it opens for approved, cancelled and celebrated rows, and is office-only), inside the Document Inspection modal in `PriestDashboard` (timeline and upcoming "Details") and inside the `CelebrantAttentionWidget` details modal. Not rendered in `UserDashboard` or any parishioner view, so no request is made there; UI gating is convenience, RLS is the enforcement.
- Tests: `web/e2e/appointment-change-history.spec.ts` (6 tests): empty state, cancel then restore shows two entries newest first with who and reasons, error state with retry, celebrant details (timeline) with note/celebrant names/Celebrated label, celebrant attention-queue details, parishioner pages make no `appointment_changes` request. Mocked e2e cannot exercise RLS itself; that is verified by reading the policy above.
