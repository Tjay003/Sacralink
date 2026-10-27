# Map: Post-Defense Client Modifications

Spec: `spec.md`

## Notes
- Build and test on `main`. Never test backend migrations against the production Supabase in `web/.env`; use local Docker Supabase (`web/e2e-local`).
- For Transfer of Ownership, Super Admin Livestream controls, and Neural Pipeline UI, **hide** them in the UI rather than deleting the underlying components/RPCs so they can be re-enabled easily if needed in the future.

## Decisions so far
- **Bible Verse Removal (Q1)**: Remove `<DailyVerse />` from `SuperAdminDashboard`, `PriestDashboard`, and `ChurchAdminDashboard` (expanding adjacent attention widgets to full width). Keep `<DailyVerse />` for `user` (Parishioner) and `volunteer`.
- **Church Delete → Indefinite Archive & Admin-Safe Restore (Q2 & Q3)**: Keep the action button named `"Delete Church"`, which archives the church (`status = 'archived'`, `archived_at = NOW()`, `archived_admin_id`) without auto-deleting after 7 days. All staff (`church_admin`, `priest`, `volunteer`) are demoted to `user` (parishioner) upon archiving. When restoring a church from the `"Archived"` tab in `ChurchesPage`, if the former `church_admin` (`archived_admin_id`) has no role at another church, auto-restore their `church_admin` role; if they already have a role at another church, prompt `super_admin` inside the Restore modal to pick a replacement `church_admin` so a church is never active without an admin.
- **User Delete → 7-Day Archive & Auto-Delete (Q3)**: Keep the action button named `"Delete Account"` / `"Delete User"`, which moves the user to an `"Archived"` tab (`archived_at = NOW()`) preserving their name/email, blocking access, and resetting any staff role to `user`. Archived users can be restored within **7 days**, and are only permanently deleted/anonymized automatically after the 7-day countdown expires.
- **Hide Transfer of Ownership (Q4)**: Hide the `"Platform Ownership Transfer"` card/button in `EditRoleModal.tsx` and update the locked role tooltip in `UsersPage.tsx`.
- **12-Month Real Donation Statistics (Q5)**: Calculate monthly donation bars dynamically from real verified donations in `DonationsPage.tsx` and show **12 months** by default (with a 6M / 12M toggle).
- **New Church in Messages & Staff Channel (Q6)**: Auto-create and sync the church's `type = 'channel'` Staff Channel when a church is created or staff are assigned, move `getOrCreateChurchStaffChannel` to a `SECURITY DEFINER` RPC so `priest`/`volunteer` never hit RLS blocks, and update `list_direct_contacts` + church list refresh on modal open.
- **Phone & Payment Number Input Validation (Q7)**: Enforce strict PH mobile limits (`09XXXXXXXXX` 11 digits / `+639XXXXXXXXX` 13 chars) and submit validation on `AddChurchPage.tsx`, `EditChurchPage.tsx`, and `PaymentChannelModal.tsx`. Do not modify `ChurchLocationPicker` coordinate number inputs.
- **Hide Super Admin Livestream Controls (Q8)**: Hide all livestream broadcast studio and configuration controls for `super_admin` across `SuperAdminDashboard`/`ChurchAdminDashboard`, `ChurchDetailPage`, `AddChurchPage`, and `EditChurchPage`.
- **Hide Neural Pipeline UI in Chatbot (Q9)**: Hide the `"Neural Pipeline"` switcher tab/inspector in `ParishAssistant.tsx` and the per-message `"Neural Core"` debug pill in `ChatMessage.tsx`.
- **San Jose del Monte, Bulacan Map Geo-Fence (Q10)**: Lock `ChurchLocationPicker.tsx` (existing Leaflet + Nominatim setup, zero new APIs) to the SJDM bounding box (`Lat: 14.750°–14.900°N`, `Lng: 120.980°–121.160°E`) across camera `maxBounds`/`minZoom`, pin placement/dragging, bounded address search, and GPS location checks.

## Tasks
- [x] 01 Remove Bible Verse on staff/admin dashboards, hide Transfer of Ownership, hide Super Admin livestream controls, and hide Chatbot Neural Pipeline UI. Blocked by: none
- [ ] 02 Upgrade Donation statistics chart to 12 months with real database aggregation and enforce strict phone/payment number validation. Blocked by: none
- [ ] 03 Geo-fence ChurchLocationPicker map and address search strictly to City of San Jose del Monte, Bulacan. Blocked by: none
- [ ] 04 Auto-provision church Staff Channels and fix new church visibility in Messages for staff and Super Admin. Blocked by: none
- [ ] 05 Implement indefinite Archive & Admin-Safe Restore for Churches and 7-day Archive & Auto-Delete for Users. Blocked by: 04
