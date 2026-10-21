# Issue 15: Optional Priest Request at Booking

Type: feature
Status: resolved
Blocked by: 12 (done)

---

## 1. Description
A parishioner can optionally request a specific priest when booking an appointment. This deliberately reverses the "no priest picker at booking" scope of ticket 05; the office still assigns the final celebrant at approval.

### Settled decisions (Tyrone, 2026-10-21)
1. **Optional.** Default is "Any available priest". Requesting a priest is never required.
2. **Request, not assignment.** New nullable column `appointments.requested_priest_id uuid references profiles(id) on delete set null`. `appointments.priest_id` (the celebrant) stays set only at approval.
3. **Warn and allow.** If the requested priest is not eligible at the chosen date and time (day off, leave, time collision, Canon 905), show a clear non-blocking warning ("Father is not available at this time"), and the parishioner can still submit. No leave reason is ever shown.
4. **Approval.** The office's approval modal pre-selects the requested priest when present and shows that it was requested. The office can pick someone else. If the office approves with a different celebrant, the parishioner's approval notification mentions that the requested priest could not be assigned.
5. **Pool list source.** The select is populated from `get_parish_clergy(p_church_id)` (name, title, designation only; status may be used to hint "On leave today" but never a reason). Use `useParishClergy`/`celebrantLabel`.
6. **Per-priest check.** Use `evaluate_parish_celebrants` (via the existing `evaluateParishPool` wrapper) to decide whether the requested priest is eligible at the chosen slot. The booking slot check from ticket 05 (`check_parish_slot`, any-priest pool) stays as is for the "Any available priest" default.
7. **Visibility.** The request shows in the office appointments table/details and on the priest's own dashboard details for requested appointments. It is shown to the parishioner on their own appointment card. Appointment change history is not required for the request itself.
8. **Web only.** Mobile booking is on standby; the new column is additive and must not break mobile reads or writes.

### Deliverables
- Next free migration (055 unless another exists): add `requested_priest_id`, extend `approve_appointment` only as needed so the approval notification can mention a differing celebrant (keep its signature and existing behavior; check `supabase/migrations/052_approve_reject_functions_and_lockdown.sql` for the current definition and RLS on parishioner INSERT so the parishioner can set the column on their own pending request). Regenerate/hand-merge `web/src/types/database.ts`.
- `BookAppointmentPage.tsx`: optional "Preferred priest" select with warning behavior; include the value in the insert.
- `ApproveAppointmentModal.tsx` / `CelebrantPicker.tsx`: pre-select and label the requested priest.
- Display of the request on the appointments page, parishioner card, priest details.
- Local e2e in `web/e2e-local` (write first): request saved, default "any" saves null, warning shown for a priest on leave but submit still works, approval pre-selects the requested priest, approving a different priest notifies the parishioner about it, no reason text anywhere, empty-pool parish hides the select.
- Apply to production only per Tyrone's standing approval: after the local suite passes, back up the foundation, apply the migration to production via Supabase MCP (project `oaczurouvaevebpimply`), verify, and record it.

---

## 2. Acceptance Criteria
- [x] Parishioner can pick a preferred priest or leave "Any available priest".
- [x] Unavailable requested priest shows a non-blocking warning without revealing why.
- [x] Office approval modal pre-selects the requested priest and can override it; override notifies the parishioner.
- [x] Request visible to office, the requested priest and the parishioner.
- [x] Parishes with no priests do not show the select.
- [x] Mobile booking and existing appointment flows unaffected.
- [x] Full `web/e2e-local` suite passes; `tsc -b` is clean.
- [x] Migration 055 applied and verified on production.

Production: migration 055 applied on 2026-10-21 (project `oaczurouvaevebpimply`). Verified read-only: `appointments.requested_priest_id` present, trigger `validate_requested_priest` present, 48 appointments unchanged and none with a request, `approve_appointment` updated with `anon` still unable to execute it, and the trigger function not callable by `authenticated`. Rollback SQL (restores the previous `approve_appointment`) was saved in the session scratchpad as `rollback_055.sql`.

---

## Resolution

Built and verified on the local Docker Supabase (122/122), then migration 055 was applied to production and verified (see the acceptance note above). The web code is on `main` only; the live site does not have the priest select until `feature/demo-mode` is updated.

### What was built
- **Migration `supabase/migrations/055_requested_priest_at_booking.sql`** (highest existing number was 054; appended to `APPLY_ALL_MIGRATIONS.sql`). ASCII only, additive and idempotent.
  - `appointments.requested_priest_id uuid null references profiles(id) on delete set null`, with a partial index. Existing rows and clients that never send it (mobile) are unaffected.
  - Trigger `validate_requested_priest` (BEFORE INSERT OR UPDATE OF requested_priest_id, church_id, SECURITY DEFINER): the requested priest must be a priest of the appointment's parish (same membership rule as `get_parish_clergy`), otherwise SQLSTATE 22023. No RLS change was needed: the parishioner INSERT policy (`auth.uid() = user_id`) and the own-pending UPDATE policy already allow the column.
  - `approve_appointment(uuid, uuid, text)`: same signature, checks, history row and notifications as migration 052. Only the parishioner's approval message changes, and only when a priest was requested and the approved celebrant is someone else (or nobody): "Your Baptism appointment has been approved! The priest you requested (Fr. X) could not be assigned; Fr. Y will preside instead." (or ", and the parish office will confirm the celebrant." when no celebrant was assigned). No leave reason is read.
- **Booking form** (`BookAppointmentPage.tsx`): optional "Preferred priest" select (`#preferred_priest`), default "Any available priest", options from `useParishClergy` / `celebrantLabel` (`get_parish_clergy`); hidden when the parish has no priests; the request is dropped when the church changes (Select This Parish). When a date and time are set, `evaluateParishPool` (`evaluate_parish_celebrants`) decides eligibility of the requested priest; if ineligible a non-blocking amber warning appears ("Rev. Fr. X is not available at this time. You can still submit..."), never the reason or Canon text. The any-priest `check_parish_slot` flow is unchanged. `createAppointmentWithDocuments` takes optional `requestedPriestId`.
- **Approval** (`ApproveAppointmentModal.tsx`): pre-selects the requested priest (unless a celebrant is already set), shows a "The parishioner requested Fr. X" banner (with a note that choosing someone else tells the parishioner), labels the option "(Requested)". If the requested priest is ineligible at the slot, the existing conflict block applies and the office must pick someone else.
- **Display**: new `RequestedPriestNote` chip ("Requested: Fr. X", `data-testid="requested-priest"`) and `lib/requestedPriest.ts`; shown on the office appointments table and mobile cards, the parishioner dashboard card, and the priest dashboard (timeline card and Details modal). `getAppointments` / `getAppointmentById` join `requested_priest` (id, full_name) and expose `requested_priest_id`.
- **Types**: `web/src/types/database.ts` hand-merged (`appointments` Row/Insert/Update and the FK).

### Notes
- `CelebrantPicker.tsx` (the Edit modal's change-celebrant list) is untracked work in progress and was not touched; it does not label the requested priest. The approve flow was the target of this ticket.
- Appointment change history does not record the request (per the ticket); the approve history row is unchanged.

### Tests
- New `web/e2e-local/booking-priest-request.spec.ts` (17 tests, written first and seen failing, then passing): request saved with `priest_id` null, default saves null, warning for a priest on leave or a weekly day off with no reason text and submit still working, select hidden for an empty-pool parish, cross-parish request rejected by the trigger, mobile-style insert without the column, profile deletion clears the request, approval pre-selects and labels, approving the requested priest sends the unchanged message, approving a different priest or nobody notifies the parishioner, ineligible requested priest blocks approval until changed, request visible to office (table), parishioner (card) and priest (timeline and Details).
- `support.ts` `createPendingAppointment` / `createApprovedAppointment` accept `requestedPriest`.
- Full local suite: 122 tests, 122 passed (previously 105). `tsc -b` clean; eslint clean on touched files (one pre-existing `exhaustive-deps` warning in `UserDashboard.tsx`, not from this change).
