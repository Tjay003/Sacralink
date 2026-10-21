# Map: Client Enhancements & Feature Pipeline

## Frontier
- [x] `01-dual-tier-frictionless-donations.md`
- [x] `02-super-admin-system-announcements-feed.md`
- [x] `03-presiding-priest-liturgy-visibility.md`
- [ ] `04-church-clergy-roster-and-status.md`
- [x] `05-booking-celebrant-pool-check.md`
- [ ] `06-customizable-sacrament-requirements-and-funeral.md`
- [x] `07-hide-raw-coordinates-on-church-page.md`
- [x] `08-fix-livestream-toggle-switch-overlap.md`
- [x] `09-parish-office-inquiry-modal-and-routing.md`
- [x] `10-app-wide-realtime-synchronization.md`
- [x] `11-in-place-staff-assignment-modal.md`
- [x] `12-celebrant-eligibility-foundation.md`
- [ ] `13-mobile-celebrant-and-clergy-parity.md`

## Tasks
1. `01-dual-tier-frictionless-donations.md` (Type: feature, Status: resolved)
2. `02-super-admin-system-announcements-feed.md` (Type: feature, Status: resolved)
3. `03-presiding-priest-liturgy-visibility.md` (Type: feature, Status: resolved, Blocked by: 12)
4. `04-church-clergy-roster-and-status.md` (Type: feature, Status: ready-for-agent, Blocked by: 12, 03)
5. `05-booking-celebrant-pool-check.md` (Type: feature, Status: resolved, Blocked by: 12)
6. `06-customizable-sacrament-requirements-and-funeral.md` (Type: feature, Status: proposed)
7. `07-hide-raw-coordinates-on-church-page.md` (Type: bug, Status: resolved)
8. `08-fix-livestream-toggle-switch-overlap.md` (Type: bug, Status: resolved)
9. `09-parish-office-inquiry-modal-and-routing.md` (Type: feature, Status: resolved)
10. `10-app-wide-realtime-synchronization.md` (Type: bug, Status: resolved)
11. `11-in-place-staff-assignment-modal.md` (Type: feature, Status: resolved)
12. `12-celebrant-eligibility-foundation.md` (Type: feature, Status: resolved)
13. `13-mobile-celebrant-and-clergy-parity.md` (Type: feature, Status: needs-triage, Blocked by: 12, 03, 04)

## Decisions so far (grilling of 03/04/05, 2026-10-21)
- Booking "priest-aware" = parish pool check (no priest picker, no LLM). Empty pool skips the priest check.
- `mass_schedules.presiding_priest_id` nullable FK on the recurring row; recurring Masses count toward collisions and Canon 905.
- One SQL source of truth (ticket 12); TS wraps it. Roster exposed through a SECURITY DEFINER RPC (no leave reasons, no contact data, works logged out).
- Web first; mobile parity is ticket 13.
- Order: 12, then 03, then 04, with 05 in parallel with 03 after 12.
- All backend work is verified on local Docker Supabase only; production changes need explicit approval per step.
- Ticket 12 shipped as migration 054 (local only): RPCs `get_parish_clergy`, `evaluate_parish_celebrants`, `check_parish_slot`; TS wrappers `getParishClergy`, `evaluateParishPool`, `checkParishSlot` in `priestAvailability.ts`; approval warnings no longer repeat leave reasons. See the ticket Resolution.
- Ticket 03 shipped (web, local only): celebrant badge on schedule cards, Presiding priest select in Add/Edit modals, celebrant in livestream standby. Streams have no link to a Mass schedule, so the live view shows none. Reusable for 04: `useParishClergy` / `celebrantLabel` in `web/src/hooks/useParishClergy.ts`. Found: Edit modal wrote a nonexistent `mass_type` column (removed) and `mass_schedules` RLS excludes `church_admin`. See the ticket Resolution.
- Ticket 05 shipped (web, local only): booking slot check and both recommendation cards now use `check_parish_slot` (pool check, empty pool unchanged, no leave reasons). Scans capped: 6 calls in parallel, 7-day horizon, 3 nearest parishes, at most 133 calls per check, stale scans aborted. Needs migration 054 on production first or checks fail open. See the ticket Resolution.
