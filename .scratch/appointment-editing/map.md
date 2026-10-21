# Map: Appointment Editing

Spec: `spec.md` · ADR: `docs/adr/0001-appointment-edits-via-database-functions.md`

## Notes
- Web only. Mobile appointment write paths break once ticket 08 lands (accepted).
- Build on `main`. `feature/demo-mode` still has the old "Change celebrant" button; don't merge it back, ticket 02 supersedes it.

## Decisions so far
- See the spec, section 2 (decisions 1–12) and section 3 (working defaults).
- Super admin keeps direct appointment UPDATE for admin tooling; every other staff role goes through functions only (ticket 08).

## Tasks
- [x] 01 Office cancels an approved appointment (tracer bullet + change history). Blocked by: none
- [x] 02 Office changes the celebrant. Blocked by: 01
- [x] 03 Office reschedules. Blocked by: 01, 02
- [x] 04 "Rescheduled from …" notice. Blocked by: 03
- [x] 05 Mark Celebrated (office and own celebrant). Blocked by: 01
- [x] 06 Office restores Cancelled or Celebrated. Blocked by: 01, 05
- [x] 07 Change history for office and celebrant. Blocked by: 01
- [x] 08 Lock down direct appointment updates. Blocked by: 02, 03, 05, 06

- 01 resolved: `appointment_changes` table, `cancel_appointment(p_appointment_id, p_reason)` function (writes `appointments.cancellation_reason`, notifies in-app from inside the function), and `EditAppointmentModal` with an action registry. See the ticket's Resolution.
- 02 resolved: `change_appointment_celebrant(p_appointment_id, p_new_priest_id, p_reason)` (migration 047), `CelebrantPicker` with a non-blocking conflict warning, Edit modal handlers now take `(appointment, reason, inputs)`, approve modal is pending-only. See the ticket's Resolution.
- 03 resolved: `reschedule_appointment(p_appointment_id, p_new_date, p_new_time, p_reason, p_new_priest_id default null)` (migration 048), one `reschedule` history row (priest_id in before/after only when the celebrant changed), UTC "today". See the ticket Resolution.
- 04 resolved: `appointments.rescheduled_from_date` + `reschedule_reason` (migration 049, written by `reschedule_appointment`), `getRescheduledNotice` helper and `RescheduledNotice` chip shown on appointments page, user dashboard, priest timeline/upcoming and attention queue. See the ticket Resolution.
- 05 resolved: `mark_appointment_celebrated(p_appointment_id, p_note default null)` (migration 050, status `completed`, office of the parish or own celebrant, `42501` otherwise, no notifications), Edit modal action with optional note, priest timeline button and "Not yet marked celebrated" attention items. See the ticket Resolution.
- 06 resolved: `restore_appointment(p_appointment_id, p_reason)` (migration 051): Cancelled or Celebrated back to approved, one `restore` history row `{"status":"cancelled"|"completed"}` to `{"status":"approved"}`, clears `cancellation_reason`, notifies parishioner and celebrant only for a restored cancellation. Edit modal offers only Restore on those rows. See the ticket Resolution.
- 07 resolved: `fetchAppointmentChanges` helper and reusable `AppointmentChangeHistory` component, shown in the Edit modal (office), the priest dashboard details modal and the celebrant attention details. RLS already excluded parishioners (046 policy unchanged by 047 to 051), so no migration. See the ticket Resolution.
- 08 resolved: migration 052 adds `approve_appointment(p_appointment_id, p_priest_id default null, p_admin_feedback default null)` and `reject_appointment(p_appointment_id, p_admin_feedback default null)` (office only, pending only, same notifications as before, `approve`/`reject` history rows) and removes direct UPDATE on `appointments` for church admin, admin and priest. Super admin and parishioners (own pending requests) keep their policies. Web uses `approveAppointment`/`rejectAppointment`; mobile admin approve/update and mobile cancel now fail (accepted). See the ticket Resolution.
