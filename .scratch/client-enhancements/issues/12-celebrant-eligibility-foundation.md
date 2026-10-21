# Issue 12: Celebrant Eligibility Foundation (shared layer for 03, 04, 05)

Type: feature
Status: resolved
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
- [x] `mass_schedules.presiding_priest_id` exists, nullable, and existing 19 production-shaped rows are unaffected.
- [x] The three RPCs exist with the grants above; `anon` cannot execute `evaluate_parish_celebrants` or `check_parish_slot`.
- [x] Dashboard day-off and blackout records change the result of `check_parish_slot` and `get_parish_clergy`.
- [x] Recurring Masses count toward collisions and Canon 905 for both approval and booking.
- [x] A parish with zero priests returns slot logic only (no priest constraint).
- [x] Existing approval, reschedule and change-celebrant e2e tests pass.
- [x] Verified on local Docker Supabase only; production is untouched until explicitly approved.
- [x] Builds and passes TypeScript validation cleanly (`tsc -b`).

---

## Resolution

Built and verified on the local Docker Supabase only. Production is untouched; migration 054 has not been applied to it.

### What was built
- **Migration `supabase/migrations/054_celebrant_eligibility_foundation.sql`** (highest existing number was 053; appended to `APPLY_ALL_MIGRATIONS.sql`). ASCII only (the Canon 905 section sign is built with `chr(167)`), idempotent.
  - `mass_schedules.presiding_priest_id uuid null references profiles(id) on delete set null`, with a partial index.
  - `get_parish_clergy(p_church_id uuid)` returns `(priest_id uuid, name text, title text, designation text, status text)`; `anon` and `authenticated`.
  - `evaluate_parish_celebrants(p_church_id uuid, p_date date, p_time time, p_exclude_appointment_id uuid default null)` returns `(priest_id uuid, eligible boolean, status text, badge_text text, badge_variant text, warnings text[], daily_count integer)`; `authenticated` only.
  - `check_parish_slot(p_church_id uuid, p_date date, p_time time)` returns one row `(slot_taken boolean, has_eligible_priest boolean, priest_count integer)`; `authenticated` only.
  - All three are `SECURITY DEFINER`, `set search_path = public`, revoked from `public`, `anon` and `authenticated` first, then granted as listed. An internal helper `mass_runs_on_weekday(text, int)` is executable by nobody but the function owner.
- **Rules as settled**: a priest belongs to a parish by `assigned_church_id` OR `church_id` and (`is_priest` or `role = 'priest'`); commitments are the priest's appointments (not cancelled or rejected, minus the excluded one) plus the recurring Masses he presides at that weekday; time collision is same HH:MM; Canon 905 limit is 2 on weekdays and 3 on Sundays; day off and leave come from `day_of_week` / `blackout_start` / `blackout_end` keyed by `priest_id`; an empty pool returns no rows from `evaluate_parish_celebrants` and `has_eligible_priest = true` from `check_parish_slot`. `reason`, email and phone are never returned.
- **TypeScript**: `web/src/lib/supabase/priestAvailability.ts` gained typed wrappers `getParishClergy`, `evaluateParishPool` and `checkParishSlot`. `web/src/lib/liturgicalScheduler.ts` keeps the signatures of `evaluateCelebrantAssignment` and `evaluateParishCelebrants` and now delegates to the RPC (one call per parish instead of several queries per priest; fails open on error as before).
- **Types**: `web/src/types/database.ts` hand-merged (the file already carries hand-written function entries, and a CLI regeneration against local reformats about 2400 lines): `mass_schedules.presiding_priest_id` (Row, Insert, Update, FK) and the three RPCs, matching `supabase gen types --local` output. `p_time` of `evaluate_parish_celebrants` is typed `string | null` because the function accepts null (skips the time collision check).

### Deviations and behaviour changes (intended)
1. **Leave reasons no longer appear in approval warnings.** The old client check put `priest_availability.reason` into the warning text. The RPC never returns it, so warnings read "Father is on his weekly day off (Thursday)." and "Father is away on clergy leave or retreat.". The leave badge used to be "On Retreat" only when the free-text reason contained "retreat"; it is now always "Unavailable / Leave". Day off still reads "Day Off".
2. **Legacy columns dropped** (`available_date` / `is_blocked`): production has 0 legacy rows (decision 4). `checkPriestIsAvailable` stays for the priest dashboard.
3. **Pool is stricter than the approve modal list.** `getChurchPriests` also lists plain `church_admin` / `admin` profiles; the RPC evaluates only decision-6 priests, so a non-priest in that list gets no badge and cannot be "Recommended". `approve_appointment` still accepts the wider pool.
4. **Title and designation**: `profiles` has no such columns, so `title` is `Rev. Fr.` and `designation` is `Priest` (role priest) or `Parish Administrator` (anyone else flagged `is_priest`); `name` is `full_name` with a leading Rev./Fr./Father removed. `in_mass` means a presiding Mass started within the last hour, in Philippine time (`Asia/Manila`); `on_leave` (today's day off or blackout) outranks it.
5. `get_parish_clergy` also returns `priest_id` (needed to join `mass_schedules.presiding_priest_id`).
6. `slot_taken` in `check_parish_slot` mirrors `isChurchSlotFree` (pending and approved count; cancelled and rejected do not).
7. `priest_availability` is still readable by every authenticated user through the table (RLS from migration 042 was not in this ticket's scope); only the RPCs are guaranteed reason-free. Tightening that policy is a follow-up.

### Tests
- New `web/e2e-local/celebrant-eligibility.spec.ts` (27 tests, written first and seen failing, then passing): schema and FK, grants (anon blocked from two RPCs, public roster, no reason/email/phone), priest-to-parish rule, day off, blackout, time collision (appointments and Masses), Canon 905 weekday and Sunday with Masses, in-Mass roster status, empty pool, slot check, Edit modal and Approve modal showing Masses.
- Full local suite: 77 tests, 77 passed (includes one `test.fail` known-gap annotation in `appointment-cancelled-card`).
- Existing expectations changed, all because of intended behaviour 1: `appointment-availability.spec.ts` (4 tests) now assert "weekly day off" / "away on clergy leave or retreat" and `not.toContainText(reason)` instead of the reason text, and the "On Retreat" badge became "Unavailable / Leave".
- Mocked suite (`web/e2e`): the RPC cannot run there, so `helpers/mockAuth.ts` serves an empty pool by default and the new `helpers/mockCelebrantRpc.ts` mirrors the rules over each spec's mocked appointments for `appointment-reschedule` and `appointment-change-celebrant`; one assertion there changed from the load notice (an artifact of the mock ignoring filters) to "No conflicts found". Mocked specs for announcements, roles, navigation, messaging, smart-recommender, parish-verification, church-map and virtual-sanctuary fail on dashboard/page copy drift unrelated to this ticket (for example the missing "Welcome Back" heading).
- `tsc -b` clean; eslint clean on all touched files.

### For tickets 03, 04, 05
- 03/04: `getParishClergy(churchId)` returns `{ data: { priestId, name, title, designation, status }[], error }`; join `mass_schedules.presiding_priest_id` to `priestId`.
- 05: `checkParishSlot(churchId, date, time)` returns `{ data: { slotTaken, hasEligiblePriest, priestCount } | null, error }`; `evaluateParishPool(churchId, date, time, excludeAppointmentId?)` returns the per-priest list.
