# Specification: Post-Defense Client Modifications — Role UI Cleanup, Archiving, 12-Month Donations, Staff Messaging, Input Validation & SJDM Geo-Fence

Status: ready-for-agent
Source: grill session, 2026-10-27
Glossary: Parish / Church, Parishioner, Volunteer, Priest, Church Admin, Super Admin, Staff Channel, Direct Message, Donation, Appointment (see `CONTEXT.md`)

---

## Problem Statement

Following the successful capstone defense, the client requested 9 targeted modifications and bug fixes:
1. **Bible Verse on Staff/Admin Dashboards**: `<DailyVerse />` is currently displayed on `SuperAdminDashboard`, `PriestDashboard`, and `ChurchAdminDashboard`, where the client wants it removed (keeping it only for Parishioners and Volunteers).
2. **Destructive Church & User Deletion**:
   - Deleting a church currently performs a hard `DELETE FROM public.churches`, permanently destroying all appointments, donations, mass schedules, and announcements.
   - Deleting a user immediately runs irreversible PII anonymization (`full_name = 'Deleted User'`, `email = NULL`) with no recovery window.
3. **Transfer of Ownership UI**: `EditRoleModal.tsx` and `UsersPage.tsx` expose a `"Platform Ownership Transfer"` flow that the client wants hidden.
4. **Donation Statistics Locked to 6 Months**: `DonationsPage.tsx` hardcodes a 6-month array (`May`–`Oct`) and uses static dummy numbers for months 1–5 even in `"Real data"` mode.
5. **New Church Missing in Messages (Especially Staff)**:
   - Creating a church or assigning staff does not auto-create the church's `type = 'channel'` Staff Channel row in `public.conversations`, leaving the `"Staff"` tab empty for new churches.
   - When a `priest` or `volunteer` clicks `"Staff channel"` on a new church, client-side `INSERT` into `conversations` fails RLS.
   - In `"New Direct Conversation"`, `allChurches` is not refreshed on modal open and `list_direct_contacts` hides new churches that only have a `priest` or `volunteer` assigned.
6. **Unvalidated / Unlimited Phone & Payment Number Inputs**: `EditChurchPage.tsx` lacks submit-time phone validation on `contact_number`, and `PaymentChannelModal.tsx` has no `maxLength` or numeric filtering on GCash/Maya account numbers.
7. **Super Admin Conducting Livestreams**: `super_admin` can currently start, stop, and configure parish livestreams from `SuperAdminDashboard`, `ChurchDetailPage`, `AddChurchPage`, and `EditChurchPage`.
8. **Neural Pipeline UI in AI Chatbot**: `ParishAssistant.tsx` exposes a `"Neural Pipeline"` diagnostics tab and `ChatMessage.tsx` renders an expandable `"Neural Core"` debug trace under every bot message, which were only needed for the defense demo.
9. **Map Not Geo-Fenced to San Jose del Monte, Bulacan**: `ChurchLocationPicker.tsx` centers on SJDM initially, but allows panning/zooming anywhere in the world, searching nationwide/worldwide addresses, and dropping pins outside San Jose del Monte, Bulacan.

---

## Solution

1. **Role UI Cleanup & Hidden Controls (Ticket 01)**:
   - Remove `<DailyVerse />` from `SuperAdminDashboard.tsx`, `PriestDashboard.tsx`, and `ChurchAdminDashboard.tsx` (expanding the adjacent attention widget to full width), while keeping `<DailyVerse />` on `UserDashboard.tsx` and `VolunteerDashboard.tsx`.
   - Hide the `"Platform Ownership Transfer"` section in `EditRoleModal.tsx` and update the locked badge tooltip in `UsersPage.tsx` (preserving `TransferOwnershipModal.tsx` and the RPC in code for potential future use).
   - Hide all livestream studio and configuration controls (`LiveBroadcastManager`, `"Studio Controls"` button on `ChurchDetailPage`, and Livestream configuration cards on `AddChurchPage` and `EditChurchPage`) when the user is `super_admin`, leaving `super_admin` with viewer-only access.
   - Hide the `"Chat" | "Neural Pipeline"` tab bar and diagnostics view in `ParishAssistant.tsx` and hide the per-message `"Neural Core"` debug trace in `ChatMessage.tsx`.
2. **12-Month Real Donation Statistics & Phone Number Validation (Ticket 02)**:
   - Replace the static 6-month chart arrays in `DonationsPage.tsx` with dynamic monthly aggregation computed from real verified donations over the **Last 12 Months** by default, with a **6 Months / 12 Months** period toggle.
   - Enforce strict Philippine mobile number formatting (`09XXXXXXXXX` 11 digits or `+639XXXXXXXXX` 13 chars) and submit-time validation on `contact_number` in `AddChurchPage.tsx` and `EditChurchPage.tsx`, and on GCash/Maya numbers in `PaymentChannelModal.tsx` (leaving `ChurchLocationPicker` coordinate inputs untouched).
3. **San Jose del Monte, Bulacan Map Geo-Fence (Ticket 03)**:
   - Apply a built-in Leaflet + Nominatim geo-fence in `ChurchLocationPicker.tsx` bounded to **City of San Jose del Monte, Bulacan** (`Lat: 14.750°N to 14.900°N`, `Lng: 120.980°E to 121.160°E`):
     - Lock Leaflet camera with `maxBounds`, `maxBoundsViscosity: 1.0`, and `minZoom: 12`.
     - Block pin placement/dragging outside SJDM with a clear warning message.
     - Restrict Nominatim search queries to the SJDM `viewbox` with `bounded=1`.
     - Validate GPS coordinates on `"Use My Current Location"` / `"Use current GPS"` before moving the pin.
4. **New Church Staff Channel Auto-Provisioning & Direct Contacts Fix (Ticket 04)**:
   - Add a `SECURITY DEFINER` RPC `ensure_church_staff_channel(p_church_id uuid)` and database triggers/hooks on church creation and `set_user_role` so every church automatically has its `type = 'channel'` Staff Channel populated with its assigned staff (`church_admin`, `priest`, `volunteer`), plus backfill all existing churches.
   - Update `getOrCreateChurchStaffChannel` in `messaging.ts` to call `ensure_church_staff_channel` so `priest`, `volunteer`, `church_admin`, and `super_admin` never hit RLS insert errors.
   - Refresh `allChurches` when opening `"New Direct Conversation"` and update `list_direct_contacts` so newly created churches and their staff are immediately visible.
5. **Delete → Archive & Restore for Churches and Users (Ticket 05)**:
   - **Churches (Indefinite Archive + Admin-Safe Restore)**:
     - Keep the button worded `"Delete Church"`, which moves the church to `status = 'archived'`, `is_active = false`, `archived_at = NOW()`, and records `archived_admin_id` (the church's `church_admin` at archive time).
     - Demote all staff (`church_admin`, `priest`, `volunteer`) of the archived church to `user` (`parishioner`) so they are not stuck in an archived parish, while keeping all appointments, donations, schedules, and announcements intact.
     - Hide archived churches from public/parishioner views and add an **"Archived"** filter tab in `ChurchesPage.tsx` (churches never auto-delete after 7 days).
     - When `super_admin` clicks **"Restore Church"**: if `archived_admin_id` is still an available `user` (no role at another church), automatically restore them as `church_admin`; if `archived_admin_id` now has a role at another church (or is unavailable), require `super_admin` to select a replacement `church_admin` (from available `user` accounts) inside the Restore modal so a restored church never exists without a `church_admin`.
   - **Users (7-Day Archive + Auto-Delete)**:
     - Keep the button worded `"Delete Account"` / `"Delete User"`, which sets `archived_at = NOW()` without wiping `full_name`, `email`, or `phone_number`, blocks login/access while archived, and resets any staff role (`priest`, `volunteer`, secondary `church_admin`) to `user` (preserving the Last Church Admin guard).
     - Add an **"Archived"** filter tab in `UsersPage.tsx` showing a **7-day countdown badge** (`"X days left before permanent deletion"`) and a **"Restore User"** button (which clears `archived_at` and restores the account as an active `user`).
     - Automatically purge/anonymize archived users whose `archived_at` is older than **7 days** (via `purge_expired_archived_users()`).

---

## Testing Decisions

- **Local Supabase Database & RLS Seam (`web/e2e-local/`)**: Test all new SQL migrations (Staff Channel auto-provisioning, `list_direct_contacts`, Church Archive/Restore RPCs, User 7-Day Archive/Restore/Auto-Purge RPCs) against local Docker Supabase first — never against production `web/.env`.
- **Frontend Build & E2E Verification (`web/e2e/`)**: Verify `tsc -b`, `vite build`, and end-to-end Playwright checks covering each of the 5 tickets.
