# Map: Client Enhancements & Feature Pipeline

## Frontier
- [x] `01-dual-tier-frictionless-donations.md`
- [x] `02-super-admin-system-announcements-feed.md`
- [x] `03-presiding-priest-liturgy-visibility.md`
- [x] `04-church-clergy-roster-and-status.md`
- [x] `05-booking-celebrant-pool-check.md`
- [ ] `06-customizable-sacrament-requirements-and-funeral.md`
- [x] `07-hide-raw-coordinates-on-church-page.md`
- [x] `08-fix-livestream-toggle-switch-overlap.md`
- [x] `09-parish-office-inquiry-modal-and-routing.md`
- [x] `10-app-wide-realtime-synchronization.md`
- [x] `11-in-place-staff-assignment-modal.md`
- [x] `12-celebrant-eligibility-foundation.md`
- [ ] `13-mobile-celebrant-and-clergy-parity.md`
- [x] `14-remove-parish-clergy-section-from-church-page.md`
- [x] `15-optional-priest-request-at-booking.md`
- [x] `16-church-owned-service-types.md`

## Tasks
1. `01-dual-tier-frictionless-donations.md` (Type: feature, Status: resolved)
2. `02-super-admin-system-announcements-feed.md` (Type: feature, Status: resolved)
3. `03-presiding-priest-liturgy-visibility.md` (Type: feature, Status: resolved, Blocked by: 12)
4. `04-church-clergy-roster-and-status.md` (Type: feature, Status: resolved, Blocked by: 12, 03; its church-page UI was removed by 14, the RPC and hook remain)
5. `05-booking-celebrant-pool-check.md` (Type: feature, Status: resolved, Blocked by: 12)
6. `06-customizable-sacrament-requirements-and-funeral.md` (Type: feature, Status: ready-for-agent, Blocked by: 16)
7. `07-hide-raw-coordinates-on-church-page.md` (Type: bug, Status: resolved)
8. `08-fix-livestream-toggle-switch-overlap.md` (Type: bug, Status: resolved)
9. `09-parish-office-inquiry-modal-and-routing.md` (Type: feature, Status: resolved)
10. `10-app-wide-realtime-synchronization.md` (Type: bug, Status: resolved)
11. `11-in-place-staff-assignment-modal.md` (Type: feature, Status: resolved)
12. `12-celebrant-eligibility-foundation.md` (Type: feature, Status: resolved)
13. `13-mobile-celebrant-and-clergy-parity.md` (Type: feature, Status: needs-triage, Blocked by: 12, 03, 04)
14. `14-remove-parish-clergy-section-from-church-page.md` (Type: feature, Status: resolved)
15. `15-optional-priest-request-at-booking.md` (Type: feature, Status: resolved locally, production migration 055 pending, Blocked by: 12)
16. `16-church-owned-service-types.md` (Type: feature, Status: built-pending-production, migration 056 not yet applied to production; foundation for 06)

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
- Ticket 04 shipped (web, local only): "Parish Clergy" cards (name with title, designation, Available / In Mass / On Leave badge, "Book with Father" to the existing booking flow) from `get_parish_clergy` only; hidden for parishes without priests. The "Fr. Second Priest" header line was an arbitrary direct `profiles` read and now comes from the roster (name, "N priests", or hidden); logged-out web access is still blocked by the `/login` redirect so that criterion is proved at the anon RPC level. See the ticket Resolution.
- Ticket 14 (2026-10-21): Tyrone rejected the public Parish Clergy cards, so the church page no longer shows a clergy roster, "Book with Father" or roster-driven priest lines (header, quick facts and Pastor of record are back to the staff lookup, hidden when no priest). Priests surface at booking instead as an optional, non-binding request (ticket 15, deliberately reversing 05's "no priest picker"). `get_parish_clergy`, `useParishClergy` and `celebrantLabel` stay for 03 and 15.
- Ticket 15 shipped (web, local only): optional "Preferred priest" at booking (`appointments.requested_priest_id`, migration 055 with a same-parish trigger and an `approve_appointment` message that tells the parishioner when the requested priest could not be assigned). Non-blocking warning from `evaluate_parish_celebrants` without any reason; approval modal pre-selects and labels the request; chip shown to office, priest and parishioner. Migration 055 still has to be applied to production. See the ticket Resolution.
- Ticket 16 shipped (web, local only): every parish owns its list of services (`church_service_types`, migration 056) seeded with the six starters; appointments and checklists link by id (`service_type_id`) while the text columns stay in step for mobile; rename follows everywhere, hide and soft delete keep history, old clients are auto-linked by trigger. The booking form lists the parish's own visible services with descriptions. The management UI is ticket 06, which can now start. The migration backfills production rows and has a read-only before and verify SQL under `supabase/verify`. See the ticket Resolution.
