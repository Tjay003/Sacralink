# 04: "Rescheduled from …" notice for parishioner, celebrant and office

Type: task
**Blocked by:** 03
**Status:** resolved

**What to build:** A rescheduled appointment carries an amber **"Rescheduled from <old date>"** notice, with the reason on hover or tap, so nobody mistakes the new date for a bug. It appears on the parishioner's appointment card, on the office appointments table (desktop and mobile layouts), and on the priest dashboard (today's timeline, upcoming sacramental ministry list and attention queue). The notice disappears once the new date has passed. The change history keeps the record permanently.

See spec decision 4.

- [x] The notice reads the latest reschedule Appointment Change for the appointment. It never changes the status.
- [x] It shows in all three audiences' views and is hidden after the new date has passed.
- [x] The reason is accessible on hover (desktop) and tap (touch).
- [x] Appointments that were never rescheduled show no notice.
- [x] The e2e test covers a rescheduled appointment showing the notice for the parishioner and for the celebrant.

## Resolution

Rescheduled approved appointments carry an amber "Rescheduled from <old date>" chip with the reason on hover, keyboard focus or tap.

- **Data for parishioners**: parishioners cannot read `appointment_changes`, so (same pattern as `cancellation_reason`) migration `049_rescheduled_notice.sql` adds `appointments.rescheduled_from_date` (date) and `appointments.reschedule_reason` (text), backfills them from the latest `reschedule` history row per appointment, and `CREATE OR REPLACE`s `reschedule_appointment` to write both on every reschedule (each new reschedule overwrites them, so the notice always reflects the latest one). `cancel_appointment` and `change_appointment_celebrant` are untouched. Ticket 06 (restore) does not need to clear them. Status is never touched.
- **Show/hide rule**: `web/src/lib/rescheduledNotice.ts` `getRescheduledNotice(appointment, today?)` returns null unless the appointment is `approved`, has `rescheduled_from_date`, and its current date is not before today (local calendar date).
- **Component**: `web/src/components/appointments/RescheduledNotice.tsx` (`appointment`, `className`). Chip is a button when a reason exists (tooltip on mouse hover and keyboard focus, toggled on tap/click, Escape and outside press close it, `role="tooltip"` portalled to body); a plain span otherwise.
- **Surfaces**: AppointmentsPage office table date cell and mobile card (this page is also the parishioner's appointment card), UserDashboard upcoming appointments card, PriestDashboard today's timeline and Upcoming sacramental ministry rows, CelebrantAttentionWidget queue rows. All queries use `select *` so no query changes; `HydratedAppointment` and `database.ts` gained the two fields.
- **Tests**: `web/e2e/appointment-rescheduled-notice.spec.ts` (parishioner hover/tap/keyboard, never-rescheduled none, past date hides, cancelled hides, office table, priest dashboard timeline/upcoming/queue).
