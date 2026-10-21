# 05: Mark an appointment Celebrated (office and own celebrant)

Type: task
**Blocked by:** 01
**Status:** resolved

**What to build:** An approved appointment can be marked **Celebrated**, with an optional note, and nobody is notified.

- **Office:** marks it from the Edit modal.
- **Priest, own appointments only:**
  - from today's timeline, via a "Mark celebrated" button that appears once the start time has passed;
  - from "Needs celebrant attention", where past approved appointments he presided at appear as "Not yet marked celebrated".

Afterwards, the priest dashboard's "Presiding today" and "Celebrated this year" counts reflect it.

See spec decisions 2, 7, 8 and ADR 0001.

- [x] A mark-celebrated database function lets the office (any appointment in its parish) or the appointment's own celebrant mark it, and rejects everyone else. It sets the status and writes an Appointment Change row (optional note) in one transaction.
- [x] Priests have no other edit actions available anywhere.
- [x] The timeline button only appears for the priest's own approved celebrations whose time has passed.
- [x] The attention queue lists the priest's past, still-approved appointments as "Not yet marked celebrated", with the same action.
- [x] Marking one updates the timeline badge to "Celebrated" and increments "Celebrated this year" without a reload (realtime refresh is fine).
- [x] The e2e test covers a priest marking a past appointment from the attention queue, and checks that he gets an error when trying to mark another priest's appointment.

## Resolution

Approved appointments can be marked Celebrated (DB status `completed`) by the office from the Edit modal and by the celebrant from his own dashboard. Nobody is notified.

- **Function** (migration `050_mark_celebrated.sql`, appended to `APPLY_ALL_MIGRATIONS.sql`): `mark_appointment_celebrated(p_appointment_id uuid, p_note text default null)`, SECURITY DEFINER, EXECUTE for `authenticated` only. Allowed for office staff of the appointment's parish (`church_admin`/`admin`; `super_admin` any parish) or the appointment's own celebrant (`priest_id = auth.uid()`); anyone else gets SQLSTATE `42501`. The appointment must be `approved` (`22023` otherwise). Sets status `completed`, writes one `appointment_changes` row (`action 'mark_celebrated'`, `reason` = trimmed note or NULL, before `{status: approved}`, after `{status: completed}`), no notifications.
- **Time rule**: none for the office (any time). For a celebrant who is not also office staff of the parish, the appointment must have started. Appointment date/time carry no time zone, so the function is deliberately lenient: it rejects only an appointment starting later than UTC now + 14 hours (it has not started anywhere on earth, `22023`). The precise local "start time has passed" rule is enforced by the web UI (`hasAppointmentStarted`).
- **Client**: `markAppointmentCelebrated(id, note?)` in `web/src/lib/supabase/appointments.ts` (empty note sent as null; dispatches the window event `APPOINTMENT_CELEBRATED_EVENT` on success so the dashboard timeline/stats and the attention queue refresh without a reload), `hasAppointmentStarted(appointment, now?)`, and the `database.ts` function entry.
- **Edit modal**: the registry's `reasonRequired: false` already modelled an optional reason, so "Mark celebrated" is just enabled with a handler; the box reads "Note (optional)". The appointments page now labels `completed` as "Celebrated" in its fallback badge (two one-line hunks, CRLF preserved).
- **PriestDashboard**: "Mark celebrated" button on timeline rows that are the priest's own, `approved`, not sample and whose start has passed (minute-tick clock). Row badge flips to Celebrated and "Celebrated this year" / "Presiding today" captions update at once (local update plus refetch); rpc errors show in an alert above the timeline. Both stats already derive from `completed` rows of this priest (the query fetches `approved` and `completed`).
- **CelebrantAttentionWidget**: his own approved appointments whose start has passed are re-tagged "Not yet marked celebrated" (listed first, no "Due soon") with a "Mark celebrated" button; removed after marking; errors shown in an alert. `RescheduledNotice` placements kept. Priests still have no Edit action anywhere (the Edit button stays office-only).
- **Tests**: `web/e2e/appointment-mark-celebrated.spec.ts` (7 tests: queue mark with rpc payload and stat increment, rpc rejection error, timeline button only after start with badge/stat update, sample rows, priest has no Edit, office mark with null note and with a trimmed note). `appointment-edit-cancel.spec.ts` now expects the "Mark celebrated" radio enabled.
