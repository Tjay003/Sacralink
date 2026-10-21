# 02: Office changes the celebrant of an approved appointment

Type: task
**Blocked by:** 01
**Status:** resolved

**What to build:** In the Edit modal, the office picks **Change celebrant**, chooses a priest from the same scored list the approve modal uses (day off, leave, double booking and Canon 905 badges), enters a reason and saves. A conflict shows as a warning but does not block the save. The new priest is notified they've been assigned, and the old priest is notified they've been removed. The parishioner gets **no** "approved" notification. This restores what commit `4a30bec` lost on `main`, and it works whether or not a celebrant was already assigned. The approve modal goes back to handling pending requests only.

See spec decisions 5, 6, 9 and ADR 0001.

- [x] A change-celebrant database function sets the celebrant and inserts an Appointment Change row (old celebrant, new celebrant, reason) in one transaction. It is office-only.
- [x] "Assign celebrant" and "Change celebrant" are both reachable on every approved appointment, desktop and mobile layouts, through Edit.
- [x] The approve modal is offered only for pending requests, and approving no longer happens on already-approved rows.
- [x] Conflict badges show for the chosen priest, and saving with a conflict is allowed after the office has seen the warning.
- [x] Notifications go to the new and old priests only, and the parishioner is not re-notified.
- [x] The new celebrant's priest dashboard shows the appointment, and the old celebrant's no longer does.
- [x] The e2e test covers changing an assigned celebrant and checking that both notifications are created.

## Resolution

The parish office can now assign or change the celebrant of any approved appointment from **Edit**. The approve modal is pending-only.

### Files
- `supabase/migrations/047_change_celebrant.sql` (also appended to `supabase/migrations/APPLY_ALL_MIGRATIONS.sql`)
- `web/src/components/appointments/CelebrantPicker.tsx` (new, scored priest list)
- `web/src/components/appointments/EditAppointmentModal.tsx` (change_celebrant enabled, `EditActionInputs`, `resolveActionText`)
- `web/src/components/appointments/ApproveAppointmentModal.tsx` (removed the already-approved branches)
- `web/src/pages/appointments/AppointmentsPage.tsx` (removed both "+ Assign celebrant" buttons; Approve modal opens only for `status === 'pending'`; `handleApproveConfirm` guards on pending)
- `web/src/lib/supabase/appointments.ts` (`changeAppointmentCelebrant`)
- `web/src/types/database.ts` (hand-edited `change_appointment_celebrant`)
- `web/e2e/appointment-change-celebrant.spec.ts` (new, 5 tests)

### Signatures
- SQL: `public.change_appointment_celebrant(p_appointment_id uuid, p_new_priest_id uuid, p_reason text) returns void`, SECURITY DEFINER, EXECUTE for `authenticated` only. Same checks and SQLSTATEs as `cancel_appointment` (28000, 22023 blank reason / not approved / new priest not a priest of the parish / null priest, P0002, 42501). The new priest must match the approve flow's pool (`getChurchPriests`): role `priest|church_admin|admin` or `is_priest`, with `assigned_church_id` or `church_id` equal to the appointment's church. Writes `appointment_changes` (`action = 'change_celebrant'`, `before_values {"priest_id": old|null}`, `after_values {"priest_id": new}`).
- Notifications (type `appointment`, link `/appointments`, inserted by the function): new priest "New Sacramental Assignment"; old priest, if any, "Celebrant Assignment Removed" with the reason. The parishioner is not notified. Nothing is sent when the new priest equals the current one.
- TS: `changeAppointmentCelebrant(id: string, newPriestId: string, reason: string): Promise<{ success: boolean; error: PostgrestError | Error | null }>`.

### Notes for later tickets
- Edit modal handlers now have the signature `(appointment, reason, inputs: EditActionInputs) => Promise<EditActionResult>`. `EditActionInputs` currently holds `{ priestId }`; ticket 03 should add its date/time fields there and render them above the reason box. `resolveActionText(action, appointment)` swaps labels per appointment (Assign vs Change celebrant), and the action picker, button text and reason label all use it.
- `CelebrantPicker` (props `appointment`, `selectedPriestId`, `onSelect`, `disabled`) loads `getChurchPriests` and `evaluateParishCelebrants` itself, marks the current celebrant as disabled, flags the recommended priest, and shows the conflict warning (`data-testid="celebrant-conflict-warning"`, text "You can still save this change") as non-blocking. Ticket 03 can reuse it, for example to warn that the existing celebrant is unavailable at the new time.
- Both the Assign and Change entries are reached through the existing Edit button (desktop table and mobile cards). Priests and volunteers never see Edit, so the old direct assign button for priests is gone by design.
- Ticket 08 note: pending approval still writes `appointments` directly (`updateAppointmentStatus`), and the `APPLY_ALL_MIGRATIONS.sql` file still lacks 045.
- Priest dashboards: `CelebrantAttentionWidget` and `getAppointments` filter on `priest_id = <viewer>` (including the realtime channel filter `priest_id=eq.<id>`), so the new celebrant sees the appointment and the old one stops seeing it as soon as the function updates `priest_id`. This is reasoned from the code, not an e2e test (the viewer would have to switch accounts mid-test against a mock).
- Notification creation is DB-side. The e2e test mocks the rpc, asserts its payload, and asserts the browser makes no direct write to `notifications` or `appointments`. The SQL itself could not be run here (no psql/docker).
- Verification: `npx tsc -b` clean, eslint clean on changed files, Playwright `appointment-change-celebrant` (5), `appointment-edit-cancel` (4), `priest-ministry` and `canon905-scheduler` all pass (18 with `smart-recommender` excluded). `smart-recommender.spec.ts` (booking form, files untouched here) has 3 failures that are unrelated to this change.
