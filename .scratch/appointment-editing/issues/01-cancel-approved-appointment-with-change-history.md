# 01: Office cancels an approved appointment (tracer bullet + change history)

Type: task
**Blocked by:** None (can start immediately)
**Status:** resolved

**What to build:** A church admin opens **Edit** on an approved appointment, chooses **Cancel**, enters a reason and saves. The appointment becomes Cancelled. The parishioner and the current celebrant each get an in-app notification with the reason, and the parishioner's appointment card shows "Cancelled" with the reason. This is the first vertical slice, so it also lays the foundation the later tickets reuse:

- The **change history table** (one Appointment Change row per edit: appointment, action, reason, before and after values, actor, timestamp), with row-level security. The office of that parish and the appointment's celebrant can read it, and nobody can write to it directly.
- A **cancel database function** that checks the caller is office staff for that parish and that the appointment is approved, then sets the status and inserts the Appointment Change row in one transaction.
- The **Edit modal** shell on the appointments page (desktop table and mobile cards), with an action picker and reason box. Only "Cancel" is enabled in this ticket.

See spec decisions 1, 2, 6, 9, 10, 11 and ADR 0001.

- [ ] A migration creates the change history table and its RLS. The next free migration number is used, and the migration is added to `APPLY_ALL_MIGRATIONS.sql` following the repo convention.
- [ ] The cancel function rejects a missing or blank reason, non-approved appointments, and callers outside that parish's office.
- [ ] "Edit" shows on approved appointments for church admin, admin and super admin only. Priests and volunteers don't see it.
- [ ] Saving Cancel without a reason is blocked in the UI, with an inline message.
- [ ] The parishioner and the current celebrant (if any) each receive one notification that includes the reason.
- [ ] The parishioner's appointment card shows Cancelled and the reason.
- [ ] The e2e test covers: open Edit, cancel with a reason, status updates in the table, and the parishioner card shows the reason.
- [ ] Typecheck, lint and the existing e2e suites stay green.

## Resolution

Office staff (church_admin, admin, super_admin) can open **Edit** on an approved appointment, choose **Cancel**, enter a reason and save. The status becomes `cancelled`, an Appointment Change row is recorded, and the parishioner and current celebrant are notified in-app, all inside one database function.

### Files
- `supabase/migrations/046_appointment_changes_and_cancel.sql` (also appended to `supabase/migrations/APPLY_ALL_MIGRATIONS.sql`; note that file does not yet contain 045, which is the user's in-progress work)
- `web/src/components/appointments/EditAppointmentModal.tsx` (new)
- `web/src/pages/appointments/AppointmentsPage.tsx` (Edit button, Cancelled badge + reason, Cancelled tab/count, modal wiring)
- `web/src/lib/supabase/appointments.ts` (`cancelAppointment`, `cancellation_reason` on `HydratedAppointment`)
- `web/src/types/database.ts` (hand-edited: `appointment_changes` table, `appointments.cancellation_reason`, `cancel_appointment` function)
- `web/e2e/appointment-edit-cancel.spec.ts` (new)

### Design notes for later tickets
- **Table `public.appointment_changes`**: `id`, `appointment_id` (FK appointments, cascade), `church_id` (denormalised for RLS), `action` (CHECK: `reschedule | change_celebrant | cancel | mark_celebrated | restore`), `reason` (nullable, so mark_celebrated can omit it), `before_values jsonb`, `after_values jsonb`, `changed_by` (FK profiles), `created_at`. RLS: SELECT only, for super_admin, admin/church_admin of that church (`COALESCE(assigned_church_id, church_id)`), and the appointment's current `priest_id`. INSERT/UPDATE/DELETE are revoked from `anon` and `authenticated`; rows are written only by SECURITY DEFINER functions. Cancel records `before_values {"status":"approved"}` and `after_values {"status":"cancelled"}`.
- **Function `public.cancel_appointment(p_appointment_id uuid, p_reason text) returns void`**, SECURITY DEFINER, `search_path = public`, EXECUTE granted to `authenticated` only. Pattern to copy in later functions: check `auth.uid()`, trim and require reason, load the row `FOR UPDATE`, check role (`super_admin`, or `admin`/`church_admin` whose `COALESCE(assigned_church_id, church_id)` equals the appointment's `church_id`), check status, update, insert the history row, insert notifications. Errors use SQLSTATE `28000` (unauthenticated), `22023` (blank reason / wrong status), `P0002` (not found), `42501` (not office). Its message surfaces in the modal via `error.message`.
- **Notification mechanism**: the function inserts directly into `public.notifications` (`user_id, type, title, message, link`) with type `appointment_cancelled`, link `/appointments`. One row for the parishioner (`user_id`) and one for the current `priest_id` (skipped when null or equal to the parishioner). The web code does not create these. Later functions should do the same so notifications stay atomic with the change.
- **Cancellation reason for parishioners**: parishioners cannot read `appointment_changes`, so the function also writes the reason to the new column `appointments.cancellation_reason` (readable under the parishioner's existing appointment SELECT policy). It holds the latest cancel reason; ticket 06 (restore) should set it back to NULL. The history table remains the permanent record.
- **Status constraint**: migration 008 created `appointments.status` with a CHECK that excluded `cancelled`/`rescheduled`; 046 replaces it (`appointments_status_check`) with all six values.
- **Edit modal**: `EditAppointmentModal` (`web/src/components/appointments/`). Props: `isOpen`, `onClose`, `appointment`, `onSaved(actionId, appointment)`. It is driven by the `EDIT_ACTIONS` registry (id, label, description, `enabled`, `reasonRequired`, labels, `destructive`) and the `EDIT_ACTION_HANDLERS` map (`(appointment, reason) => Promise<{success, error}>`). To add an action in tickets 02/03/05/06: add a client function next to `cancelAppointment` in `appointments.ts` that calls the new rpc, set `enabled: true`, register the handler, and (if it needs extra inputs such as a celebrant or date) render them in the modal body above the reason box and widen the handler signature to receive them. Disabled actions are shown as "Not available yet". The `EditActionId` type already contains `change_celebrant`, `reschedule`, `mark_celebrated`; add `restore` when needed (restore applies to cancelled/celebrated rows, so ticket 06 needs a separate entry point, since Edit currently shows only for approved).
- **Visibility**: `canEditAppointments` in `AppointmentsPage` is `admin | super_admin | church_admin` and Edit renders only inside the existing `canManageAppointments && status === 'approved'` branch (desktop table and mobile card). Priests and volunteers never see it.
- **Cancelled display**: the status cell/card shows a red "Cancelled" badge plus `Reason: <cancellation_reason>`. A "Cancelled" filter tab and count were added next to Rejected.
- **Direct UPDATE on appointments is still allowed**; ticket 08 locks it down.
- **Verification**: the SQL could not be run (no psql/docker). `npx tsc -b` and eslint on changed files are clean. Playwright: `appointment-edit-cancel.spec.ts` (4 tests, rpc route mocked and payload asserted), `priest-ministry.spec.ts` and `canon905-scheduler.spec.ts` all pass (12 tests).
