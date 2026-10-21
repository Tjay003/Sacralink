# Issue 05: Booking Celebrant Pool Check (replaces "Priest-Schedule Aware AI Recommender")

Type: feature
Status: resolved
Blocked by: 12

---

## 1. Description
The booking flow already renders two smart alternative cards (same church, nearby church) through `web/src/lib/recommender.ts` and `BookAppointmentPage.tsx` (`data-testid="recommendation-card-same-church"` / `recommendation-card-nearby-church`). They are not priest-aware, and this ticket does not add an LLM. The recommender is a deterministic rules engine; the AI chatbot (`aiFallback.ts`) is unrelated.

### What is wrong today
- `isChurchSlotFree` reads `priest_availability` by legacy columns (`church_id`, `available_date`, `is_blocked`). The priest dashboard writes day-off and blackout by `priest_id`, so a priest on leave has no effect on booking.
- It queries `appointments` as the parishioner. RLS shows a parishioner only their own appointments, so "slot already booked by another parishioner" and any priest-load check under-report.

### Settled scope
1. **No priest picker at booking.** The parishioner does not choose a priest; the office assigns the celebrant at approval (`appointments.priest_id`). The original "select a preferred priest" and "Select This Alternative also updates the priest" are dropped.
2. **Parish pool check.** A slot is available only if it is not already taken and at least one priest in the parish is eligible (day-off, blackout, time collision, Canon 905 including recurring Masses). All of this comes from `check_parish_slot` (ticket 12), not client-side reads.
3. **Empty pool skips the priest check.** A parish with no priests assigned behaves as it does today. Nothing becomes unbookable.
4. **Cards stay, content gets accurate.** Same-church card: next slot where the pool has an eligible priest. Nearby-church card: nearest active parish with an open slot and an eligible priest (or no priests, per rule 3). The conflict message explains the cause without exposing leave reasons ("No celebrant is available at this time").
5. `recommender.ts` keeps its exported API (`evaluateSlotAndRecommendations`, `SlotRecommendation`, `AvailabilityCheckResult`) so `BookAppointmentPage.tsx` and its e2e tests keep working. Remove the legacy `priest_availability` read.
6. Debounce and cap the number of RPC calls when scanning alternative slots (the current code does up to 14 days by 9 slots by N churches sequentially).

### Files Involved
- `web/src/lib/recommender.ts`
- `web/src/pages/appointments/BookAppointmentPage.tsx` (only if card wording changes)
- `web/src/lib/supabase/appointments.ts` (only if needed)

---

## 2. Acceptance Criteria
- [x] A priest's dashboard day-off or blackout makes that parish's slots unavailable when they are the only priest, and still available when another eligible priest exists.
- [x] Recurring Masses count toward priest collisions and Canon 905 in the booking check.
- [x] Slots taken by other parishioners are detected as a parishioner.
- [x] Parishes with no priests behave exactly as before.
- [x] Both recommendation cards still render, and "Select This Alternative" still fills church, date and time.
- [x] No leave reason, email or phone appears in the UI or network responses.
- [x] Existing booking e2e tests pass; new tests cover the unavailable-priest case on local Supabase.
- [x] Builds and passes TypeScript validation cleanly (`tsc -b`).

---

## Resolution

Built and verified on the local Docker Supabase only. No migration or RPC was changed; production is untouched (and still lacks migration 054, see below).

### What was built
- **`web/src/lib/recommender.ts`** now asks `checkParishSlot` (ticket 12) for every slot. The legacy `priest_availability` read and the parishioner-visible `appointments` query are gone. A slot is available only if it is not taken and `hasEligiblePriest` is true; an empty pool (`priestCount` 0) returns `hasEligiblePriest = true`, so a parish without priests behaves as before. Exported API unchanged: `evaluateSlotAndRecommendations`, `SlotRecommendation`, `AvailabilityCheckResult`, `isChurchSlotFree`, `findNextAvailableSlotAtChurch`, `findNearestAlternativeParish`, `STANDARD_TIME_SLOTS` and the formatters. The three functions that scan gained an optional trailing `signal?: AbortSignal`.
- **Conflict wording**: taken slot keeps "This time slot is already booked by another parishioner."; no eligible priest reads "No celebrant is available at this time." (no reason, no priest name). A taken slot wins when both apply.
- **Cards**: same-church card is the next slot where the pool has an eligible priest; nearby card is the nearest active parish with an open, staffed slot (a parish without priests qualifies). No priest picker, no LLM.
- **`web/src/pages/appointments/BookAppointmentPage.tsx`**: the existing 300 ms debounce now also aborts the previous check (AbortController) when the date, time, service or parish changes, so a stale scan stops sending calls and cannot overwrite a newer answer. The empty state copy now says "next 7 days" to match the new horizon.

### Call cap and parallelism (the chosen numbers)
Before: up to 14 days x 9 slots for the same parish plus 9 slots (and a 14-day fallback) per other parish, all sequential and uncached, two queries per slot.
- One RPC per slot (`check_parish_slot`), cached per availability check (`parish|date|time`), so a repeated slot costs nothing.
- Candidates are checked `SLOT_CHECK_CONCURRENCY = 6` at a time, in order, and each scan stops at its first open slot (typically one batch, about 7 to 10 calls in total).
- Same-parish scan: later slots today plus `SAME_CHURCH_SCAN_DAYS = 7` days, budget `SAME_CHURCH_CHECK_BUDGET = 72` calls.
- Nearby scan: only the `NEARBY_CHURCH_LIMIT = 3` nearest active parishes are tried for the requested date, then the nearest parish's next open slot as before; budget `NEARBY_CHECK_BUDGET = 60` calls.
- Hard ceiling per availability check: 1 + 72 + 60 = 133 calls, at most 12 in flight (two scans run side by side). The local test counts the real requests and asserts the ceiling when nothing is open in 60 days.

### Behaviour changes worth knowing
1. The same-parish horizon shrank from 14 to 7 days and the nearby search looks at the 3 nearest parishes instead of all of them (then falls back to the nearest parish's next slot). A priest on a long retreat therefore yields "No additional slots found in the next 7 days" for the same parish; the nearby card still appears if another parish is open.
2. An alternative whose check fails (RPC error) is never recommended. The requested slot itself still fails open (shown as available), as before.
3. **Production dependency**: until migration 054 is applied to production, `check_parish_slot` does not exist there, so every check fails open and booking shows no conflicts (the previous collision detection is gone from the UI; the database remains the final authority on approval). Apply migration 054 before shipping this ticket to production.
4. `priest_availability` is no longer read by the browser during booking, so leave reasons never reach the booking page or its network responses (the RPC returns only booleans and a count).

### Tests
- New `web/e2e-local/booking-celebrant-pool.spec.ts` (15 tests, written first: 11 failed, 4 passed before the change, all 15 after): day off and blackout of the only priests (unavailable, no reason shown), still available with a second eligible priest, recurring Mass time collision, one-priest Mass leaving the other, Canon 905 weekday limit through recurring Masses, a pending request of another user detected although RLS hides it from the parishioner, a cancelled request freeing the slot, empty pool unchanged (also still reports a taken slot), both cards render, Select This Slot fills date and time, Select This Parish switches church keeping date and time, nearby card falls to another day when the other parish's only priest is off, no leave reason/email/phone in the page or RPC responses, and the call ceiling.
- Full local suite: 104 tests, 104 passed (includes one `test.fail` known-gap annotation in `appointment-cancelled-card`); it was 89 before this ticket.
- Mocked suite (`web/e2e`): `helpers/mockAuth.ts` gained a default `check_parish_slot` stub (empty pool; church-1 on 2026-09-15 at 10:00 reported taken, mirroring the old mock appointment). `smart-recommender` passes 4/4. The full mocked run is 78 passed, 27 failed; the failures are the same unrelated page-copy drift listed in ticket 12 (announcements, roles, navigation, messaging, parish-verification, church-map, virtual-sanctuary, super admin login), none touch booking.
- `tsc -b` clean; eslint clean on all touched files.
