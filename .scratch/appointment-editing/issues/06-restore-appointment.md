# 06: Office restores a Cancelled or Celebrated appointment

Type: task
**Blocked by:** 01, 05
**Status:** resolved

**What to build:** When an appointment was cancelled or marked celebrated by mistake, the office opens **Edit**, chooses **Restore to approved**, enters a required reason and saves. The appointment returns to approved, and the restore is recorded as its own Appointment Change. Restoring a cancellation notifies the parishioner and the celebrant. Restoring a Celebrated appointment notifies no one, matching how marking it notified no one.

See spec decisions 1, 2, 6.

- [x] A restore database function is office-only, requires a reason, only accepts Cancelled or Celebrated appointments, and writes the status change and the Appointment Change row in one transaction.
- [x] The Edit modal offers only "Restore to approved" for Cancelled and Celebrated appointments.
- [x] Notifications follow the rule above.
- [x] Priest dashboard counts and lists update after a restore.
- [x] The e2e test covers cancelling, then restoring, and checks that the appointment is approved again with both changes in its history.

## Resolution

- Migration `supabase/migrations/051_restore_appointment.sql` (also appended to `APPLY_ALL_MIGRATIONS.sql`): `restore_appointment(p_appointment_id uuid, p_reason text)`, SECURITY DEFINER. Office of the parish only (super admin any), `42501` otherwise; blank reason and any status other than `cancelled` or `completed` raise `22023`. Sets status `approved`, clears `cancellation_reason` when restoring a cancellation, writes one `appointment_changes` row (`restore`, `{"status":"cancelled"|"completed"}` to `{"status":"approved"}`).
- Notifications: a restored cancellation notifies the parishioner and the current celebrant (type `appointment`, title "Appointment Restored", message includes the reason; celebrant skipped if null or the same person). A restored Celebrated appointment notifies no one.
- Web: `restoreAppointment(id, reason)` in `web/src/lib/supabase/appointments.ts`, `database.ts` typed by hand. `EditAppointmentModal` gained a `restore` action; Cancelled and Celebrated rows list only "Restore to approved" (reason required), approved rows list the original four. `AppointmentsPage` shows Edit (desktop table and mobile cards) on cancelled and completed rows for admin, church admin and super admin; priests and parishioners see none.
- Priest dashboard: no code change needed. `PriestDashboard` and `CelebrantAttentionWidget` already subscribe to realtime `appointments` changes (event `*`, filtered by `priest_id`), so a restore by the office refreshes counts and lists. Parishioner cards derive the Cancelled badge from status, so it disappears.
- Tests: `web/e2e/appointment-restore.spec.ts` (cancel then restore with two ordered rpc calls and two mock history rows, required-reason block, Celebrated row offers only Restore, mobile, priest has no Edit). Two older assertions ("Edit gone after cancel/celebrate") were updated because Edit now stays for Restore.
