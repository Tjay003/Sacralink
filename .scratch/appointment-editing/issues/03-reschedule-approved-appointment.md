# 03: Office reschedules an approved appointment

Type: task
**Blocked by:** 01, 02
**Status:** resolved

**What to build:** In the Edit modal, the office picks **Reschedule**, sets a new date and time, enters a reason and saves. The appointment stays approved with the new schedule. The celebrant check re-runs for the new slot and shows any conflict as a warning the office can override, and the office can switch celebrant in the same save. The parishioner and the celebrant (both old and new, if the celebrant changed) are notified, with the old date, new date and reason.

See spec decisions 3, 5, 6 and the working default "no past dates".

- [x] A reschedule database function updates the date and time, optionally changes the celebrant, and writes the Appointment Change row(s) recording the old and new schedule and celebrant, plus the reason, in one transaction. It is office-only.
- [x] Past dates can't be selected and are rejected by the function.
- [x] The status stays approved, and `rescheduled` is never written as a status.
- [x] The conflict warning appears for the new slot, and saving with an override is allowed.
- [x] Notifications are sent per spec decision 6, including both priests when the celebrant changes in the same save.
- [x] The e2e test covers rescheduling onto the celebrant's day off, seeing the warning, overriding it and saving.

## Resolution

The office can reschedule an approved appointment from **Edit > Reschedule**: new date and time, optional celebrant switch, required reason. The appointment stays approved.

### Files
- `supabase/migrations/048_reschedule_appointment.sql` (also appended to `supabase/migrations/APPLY_ALL_MIGRATIONS.sql`)
- `web/src/components/appointments/EditAppointmentModal.tsx` (reschedule enabled, date/time inputs, `EditActionInputs` gains `date` and `time`)
- `web/src/components/appointments/CelebrantPicker.tsx` (new `allowKeepCurrent` prop)
- `web/src/lib/supabase/appointments.ts` (`rescheduleAppointment`), `web/src/types/database.ts` (hand-edited)
- `web/e2e/appointment-reschedule.spec.ts` (new, 3 tests); `web/e2e/appointment-edit-cancel.spec.ts` (now asserts Mark celebrated, not Reschedule, is the disabled entry)

### Signatures
- SQL: `public.reschedule_appointment(p_appointment_id uuid, p_new_date date, p_new_time time, p_reason text, p_new_priest_id uuid default null) returns void`, SECURITY DEFINER, EXECUTE for `authenticated` only. Errors: 28000 unauthenticated, 22023 blank reason / null date or time / past date / not approved / nothing changed / new priest not of the parish, P0002 not found, 42501 not office.
- "Today" for the past-date rule is the UTC date (`NOW() AT TIME ZONE 'UTC'`), matching the web app's `new Date().toISOString()` (the modal's `min`).
- TS: `rescheduleAppointment(id, newDate, newTime, reason, newPriestId?)`.

### History row shape (for tickets 04 and 07)
ONE `appointment_changes` row, `action = 'reschedule'`, `reason`, `before_values = {"appointment_date": "YYYY-MM-DD", "appointment_time": "HH:MI:SS"}`, `after_values` same keys with the new values. When the celebrant changes in the same save, both objects also carry `"priest_id"` (before may be null). No separate `change_celebrant` row. The old date is always `before_values.appointment_date`.

### Notifications (written by the function)
Parishioner: "Appointment Rescheduled" (type `appointment_rescheduled`) with old, new and reason. Celebrant after the save: unchanged celebrant gets "Appointment Rescheduled"; a newly chosen one gets "New Sacramental Assignment" (with the old slot and reason). Replaced celebrant: "Celebrant Assignment Removed". A person who is also the parishioner gets only the parishioner message.

### Notes
- Conflict warning: the modal re-renders `CelebrantPicker` with the new date/time (same appointment id, so no self-collision). The current celebrant starts selected ("keep"); the warning is non-blocking. The picker is hidden for past or incomplete slots.
- The SQL could not be run here (no psql/docker). The mocked appointments endpoint ignores filters, so the e2e free-date step only asserts there is no day-off warning.
- `smart-recommender.spec.ts` has 3 failures that pre-exist on a clean HEAD worktree (unrelated).
