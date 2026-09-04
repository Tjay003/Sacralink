# Issue 04: Sacrament Appointment & Booking Engine

Type: task  
Status: ready-for-agent  
Blocked by: 02  

---

## 1. Description
Build the mobile sacrament booking engine enforcing deterministic schedule validation against operating hours, priest availability, and service duration constraints, with document uploads (camera/gallery) and a live status tracker.

---

## 2. Acceptance Criteria
- [ ] Sacrament selection picker (Baptism, Wedding, Funeral, Confirmation, Counseling, Mass Intention, Anointing, Blessing).
- [ ] Date & Time picker querying `priest_availability`, `service_durations`, and `appointments` to block taken slots.
- [ ] Dynamic document requirements checklist (`sacrament_requirements` table) with camera capture (`expo-image-picker`) and PDF file picker (`expo-document-picker`).
- [ ] Client-side image compression (`expo-image-manipulator`) before uploading to `documents` storage bucket.
- [ ] "My Appointments" screen (`app/(tabs)/appointments/index.tsx`) with status chips (`pending`, `approved`, `rejected`, `completed`) and pull-to-refresh.
- [ ] Appointment detail modal showing booking summary, uploaded documents, priest assigned, and admin remarks.

---

## 3. Implementation Steps
1. Create `mobile/src/lib/supabase/appointments.ts`.
2. Build `app/appointments/book.tsx` multi-step booking wizard.
3. Build `mobile/src/components/appointments/DocumentUploader.tsx`.
4. Create `app/(tabs)/appointments/index.tsx` list and detail view.
