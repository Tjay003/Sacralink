# Issue 12: Celebrant Eligibility Foundation (shared layer for 03, 04, 05)

Type: feature
Status: ready-for-agent
Blocked by: 

---

## 1. Description
Tickets 03, 04 and 05 all need to answer "who presides where, and is this priest free?". Today that logic is split and partly blind:

- `web/src/lib/liturgicalScheduler.ts` (`evaluateCelebrantAssignment` / `evaluateParishCelebrants`) knows day-off, blackout, time collisions and Canon 905, but only counts **appointments**, and only runs at approval time.
- `web/src/lib/recommender.ts` reads `priest_availability` by the **legacy** columns (`church_id`, `available_date`, `is_blocked`). The priest dashboard writes `day_of_week` / `blackout_start` / `blackout_end` keyed by `priest_id`, so dashboard leave never affects booking. Production has 3 availability rows, all new-format, 0 legacy.
- Under RLS a parishioner can only read their own appointments, so any client-side check of other bookings or priest load under-reports.
- `priest_availability.reason` (free text, e.g. sick leave) is readable by every authenticated user.

This ticket builds one server-side source of truth that 03, 04 and 05 consume.

### Decisions (settled in grilling)
1. **Single SQL layer**: the eligibility computation lives in SQL; TypeScript is a thin wrapper. The existing `liturgicalScheduler.ts` API (`evaluateCelebrantAssignment`, `evaluateParishCelebrants`) keeps its signatures and delegates to the RPC so the approval modal (`ApproveAppointmentModal.tsx`, `CelebrantPicker.tsx`) and the celebrant-change flow keep working.
2. **Presiding priest on Masses**: add `mass_schedules.presiding_priest_id uuid null references profiles(id) on delete set null`. It is a weekly default, not a per-occurrence assignment.
3. **Masses count**: a priest's recurring Masses count toward the time-collision check and the Canon 905 daily limit (weekday 2, Sunday 3), on top of appointments.
4. **Safe exposure**: RPCs are `SECURITY DEFINER`, return computed status only, never leave `reason`, email or phone, and are executable by `anon` and `authenticated` only where listed below.
5. **Empty pool**: a parish with no priests assigned has no priest constraints; callers fall back to existing slot logic.
6. **Priest-to-parish link**: a priest belongs to a parish when `assigned_church_id` OR `church_id` matches and (`is_priest = true` or `role = 'priest'`). Production has an `admin` with `is_priest = true`; that counts.

### Deliverables
- Migration (next free number after the current highest in `supabase/migrations/`): the `mass_schedules` column, plus
  - `get_parish_clergy(p_church_id uuid)` returns name, title, designation and status (`available` | `in_mass` | `on_leave`). Callable by `anon` and `authenticated`.
  - `evaluate_parish_celebrants(p_church_id uuid, p_date date, p_time time, p_exclude_appointment_id uuid default null)` returns per-priest eligibility, badge status, daily count and warnings. Callable by `authenticated`.
  - `check_parish_slot(p_church_id uuid, p_date date, p_time time)` returns whether the slot is taken and whether at least one priest is eligible (true when the parish has no priests). Callable by `authenticated`.
- Regenerate `web/src/types/database.ts`.
- `web/src/lib/supabase/priestAvailability.ts` / `liturgicalScheduler.ts`: wrappers around the RPCs.
- Local e2e coverage in `web/e2e-local` (see `docs/agents/local-testing.md`): day-off, blackout, time collision, Canon 905 with Masses (weekday and Sunday), empty pool, anon cannot read leave reasons.

### Regression watch
Counting Masses can turn previously "Available" priests into "Canon 905 Limit" or "Time Collision" at approval. Re-run the existing appointment-editing suite (approve, reschedule, change-celebrant) and adjust expectations only where the new behavior is intended.

---

## 2. Acceptance Criteria
- [ ] `mass_schedules.presiding_priest_id` exists, nullable, and existing 19 production-shaped rows are unaffected.
- [ ] The three RPCs exist with the grants above; `anon` cannot execute `evaluate_parish_celebrants` or `check_parish_slot`.
- [ ] Dashboard day-off and blackout records change the result of `check_parish_slot` and `get_parish_clergy`.
- [ ] Recurring Masses count toward collisions and Canon 905 for both approval and booking.
- [ ] A parish with zero priests returns slot logic only (no priest constraint).
- [ ] Existing approval, reschedule and change-celebrant e2e tests pass.
- [ ] Verified on local Docker Supabase only; production is untouched until explicitly approved.
- [ ] Builds and passes TypeScript validation cleanly (`tsc -b`).
