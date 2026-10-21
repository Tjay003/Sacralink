# Issue 09: Admin & Priest Mobile Workflows & Triage Hub

Type: task  
Status: resolved  
Blocked by: 04, 05  

---

## 1. Description
Build the mobile management workflows for Church Admins (approving/rejecting sacrament requests, verifying donation receipts, publishing urgent announcements, editing parish info) and Priests (liturgical calendar, assigned appointments, availability toggle).

---

## 2. Acceptance Criteria
- [x] Church Admin Dashboard (`app/(tabs)/admin/index.tsx`):
  - Pending appointment count badge & quick-action list.
  - Pending donation count badge & quick-verify list.
  - Urgent announcement composer.
- [x] Mobile Appointment Review Modal: View parishioner submitted documents, approve with notes, or reject with reason.
- [x] Mobile Donation Verification Modal: Fullscreen receipt zoom, verify reference number against merchant amount, mark Verified or Rejected.
- [x] Priest Schedule Dashboard (`app/(tabs)/priest/index.tsx`):
  - Today's Mass schedule and assigned sacrament appointments.
  - Quick availability toggle (set day on/off).

---

## 3. Implementation Steps
1. Create `mobile/src/components/admin/AdminAppointmentCard.tsx`.
2. Create `mobile/src/components/admin/AdminDonationCard.tsx`.
3. Build routes under `app/(tabs)/admin/` and `app/(tabs)/priest/`.

---

## Resolution
- Created `mobile/src/lib/supabase/adminWorkflows.ts`:
  - `fetchAdminParishMetrics(churchId)`: Aggregates pending appointment requests, unverified donations, and active church announcements with parish attribution.
  - `fetchChurchAppointments(churchId, statusFilter?)`: Queries church sacrament bookings joined with parishioner profiles, attached certificate documents, and assigned priest info.
  - `updateAppointmentStatus(appointmentId, status, remarks?, priestId?)`: Updates appointment status (`approved` / `rejected` / `completed`), records `admin_feedback` and assigned officiating priest, and dispatches in-app notifications directly to the applicant without cross-user RLS blocking.
  - `fetchChurchDonations(churchId, statusFilter?)`: Queries cashless donation offerings joined with donor profiles, payment references, and proof receipts.
  - `updateDonationStatus(donationId, status, notes?)`: Records administrative payment verification (`verified` / `rejected`) with verifier user ID, audit timestamp, and dispatches in-app donor notifications.
  - `fetchPriestSchedule(priestId, churchId?)`: Queries assigned sacrament ceremonies, appointments, and parish mass schedules.
  - `fetchPriestAvailability(priestId, date)`: Resolves priest availability on a specified date.
  - `togglePriestDayAvailability(priestId, churchId, date, isAvailable, notes?)`: Upserts availability status in `priest_availability` table (on-duty vs off-duty).
  - `createParishAnnouncement(churchId, title, content, priority, imageUrl?)`: Broadcasts church announcement to `church_announcements` and mirrors to legacy announcements table.
  - Exported complete TanStack Query hooks: `useAdminParishMetrics`, `useChurchAppointments`, `useUpdateAppointmentStatus`, `useChurchDonations`, `useUpdateDonationStatus`, `usePriestSchedule`, `usePriestAvailability`, `useTogglePriestDayAvailability`, `useCreateParishAnnouncement`, and `useChurchPriests`.
- Created Database Migration `supabase/migrations/031_add_appointment_priest_and_feedback.sql`:
  - Added `priest_id` (UUID references profiles) and `admin_feedback` (TEXT) columns with indexing.
  - Added RLS policies enabling priests to view and manage their assigned appointments.
- Created `mobile/src/components/admin/AdminAppointmentCard.tsx`:
  - Card displays applicant identity, sacrament badge, scheduled date/time, documents count, and notes preview.
  - Triage modal with submitted certificate document viewer (full screen lightbox preview and external link option), priest assignment selector, admin feedback/rejection reason input, and "Approve Ceremony" vs "Reject Request" actions.
- Created `mobile/src/components/admin/AdminDonationCard.tsx`:
  - Card displays offering amount in PHP, purpose badge, reference number with 1-click clipboard copy, status badge, and receipt proof thumbnail.
  - Verification modal with pinch/zoom full-screen receipt inspector (`ScrollView` with native `maximumZoomScale`), reference number verification, admin audit notes, and "Verify Payment" vs "Reject Payment" actions.
- Built Church Admin Routes:
  - `mobile/app/(tabs)/admin/index.tsx`: Parish overview header, live triage badges (Pending Bookings & Pending Offerings) navigating to triage queues, "Broadcast Urgent Announcement" modal composer with priority tags (`urgent`, `advisory`, `event`, `general`), shortcuts to appointments, donations, and chat, and pull-to-refresh.
  - `mobile/app/(tabs)/admin/appointments.tsx`: Status filter tabs (Pending, Approved, Rejected, All), client-side search across parishioner name and sacrament, pull-to-refresh, empty states, and `AdminAppointmentCard` triage list.
  - `mobile/app/(tabs)/admin/donations.tsx`: Status filter tabs (Pending Verification, Verified, Rejected), search across donor name and reference number, pull-to-refresh, and `AdminDonationCard` verification list.
- Built Priest Ministry Routes:
  - `mobile/app/(tabs)/priest/index.tsx`: Priestly ministry header, today's and tomorrow's quick availability toggles (on-duty vs off-duty), today's mass timetable by day of week, assigned sacrament ceremonies list with parishioner contacts and special prayer intentions, and pull-to-refresh.
  - `mobile/app/(tabs)/priest/consultations.tsx`: Virtual pastoral care dispatch room, encrypted video counseling banner, instant personal consultation chamber launcher, list of scheduled virtual counseling appointments, and "Launch Video Room (Jitsi Meet)" actions.
- Validated with `npx tsc --noEmit` (0 errors) and Android Hermes compilation via `npx expo export --platform android` (Success, 0 errors).

