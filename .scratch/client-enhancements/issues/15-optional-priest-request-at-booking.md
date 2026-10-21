# Issue 15: Optional Priest Request at Booking

Type: feature
Status: ready-for-agent
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
- [ ] Parishioner can pick a preferred priest or leave "Any available priest".
- [ ] Unavailable requested priest shows a non-blocking warning without revealing why.
- [ ] Office approval modal pre-selects the requested priest and can override it; override notifies the parishioner.
- [ ] Request visible to office, the requested priest and the parishioner.
- [ ] Parishes with no priests do not show the select.
- [ ] Mobile booking and existing appointment flows unaffected.
- [ ] Full `web/e2e-local` suite passes; `tsc -b` is clean; migration applied and verified on production.
