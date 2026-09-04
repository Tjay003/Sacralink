# Issue 09: Admin & Priest Mobile Workflows & Triage Hub

Type: task  
Status: ready-for-agent  
Blocked by: 04, 05  

---

## 1. Description
Build the mobile management workflows for Church Admins (approving/rejecting sacrament requests, verifying donation receipts, publishing urgent announcements, editing parish info) and Priests (liturgical calendar, assigned appointments, availability toggle).

---

## 2. Acceptance Criteria
- [ ] Church Admin Dashboard (`app/(tabs)/admin/index.tsx`):
  - Pending appointment count badge & quick-action list.
  - Pending donation count badge & quick-verify list.
  - Urgent announcement composer.
- [ ] Mobile Appointment Review Modal: View parishioner submitted documents, approve with notes, or reject with reason.
- [ ] Mobile Donation Verification Modal: Fullscreen receipt zoom, verify reference number against merchant amount, mark Verified or Rejected.
- [ ] Priest Schedule Dashboard (`app/(tabs)/priest/index.tsx`):
  - Today's Mass schedule and assigned sacrament appointments.
  - Quick availability toggle (set day on/off).

---

## 3. Implementation Steps
1. Create `mobile/src/components/admin/AdminAppointmentCard.tsx`.
2. Create `mobile/src/components/admin/AdminDonationCard.tsx`.
3. Build routes under `app/(tabs)/admin/` and `app/(tabs)/priest/`.
