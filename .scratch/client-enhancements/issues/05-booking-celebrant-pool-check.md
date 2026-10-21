# Issue 05: Booking Celebrant Pool Check (replaces "Priest-Schedule Aware AI Recommender")

Type: feature
Status: ready-for-agent
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
- [ ] A priest's dashboard day-off or blackout makes that parish's slots unavailable when they are the only priest, and still available when another eligible priest exists.
- [ ] Recurring Masses count toward priest collisions and Canon 905 in the booking check.
- [ ] Slots taken by other parishioners are detected as a parishioner.
- [ ] Parishes with no priests behave exactly as before.
- [ ] Both recommendation cards still render, and "Select This Alternative" still fills church, date and time.
- [ ] No leave reason, email or phone appears in the UI or network responses.
- [ ] Existing booking e2e tests pass; new tests cover the unavailable-priest case on local Supabase.
- [ ] Builds and passes TypeScript validation cleanly (`tsc -b`).
