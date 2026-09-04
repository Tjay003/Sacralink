# Issue 04: Sacrament Appointment & Booking Engine

Type: task  
Status: resolved  
Blocked by: 02  

---

## 1. Description
Build the mobile sacrament booking engine enforcing deterministic schedule validation against operating hours, priest availability, and service duration constraints, with document uploads (camera/gallery) and a live status tracker.

---

## 2. Acceptance Criteria
- [x] Sacrament selection picker (Baptism, Wedding, Funeral, Confirmation, Counseling, Mass Intention, Anointing, Blessing).
- [x] Date & Time picker querying `priest_availability`, `service_durations`, and `appointments` to block taken slots.
- [x] Dynamic document requirements checklist (`sacrament_requirements` table) with camera capture (`expo-image-picker`) and PDF file picker (`expo-document-picker`).
- [x] Client-side image compression (`expo-image-manipulator`) before uploading to `documents` storage bucket.
- [x] "My Appointments" screen (`app/(tabs)/appointments/index.tsx`) with status chips (`pending`, `approved`, `rejected`, `completed`) and pull-to-refresh.
- [x] Appointment detail modal showing booking summary, uploaded documents, priest assigned, and admin remarks.

---

## 3. Implementation Steps
1. Create `mobile/src/lib/supabase/appointments.ts`.
2. Build `app/appointments/book.tsx` multi-step booking wizard.
3. Build `mobile/src/components/appointments/DocumentUploader.tsx`.
4. Create `app/(tabs)/appointments/index.tsx` list and detail view.

---

## Resolution
- Installed `expo-image-picker`, `expo-document-picker`, and `expo-image-manipulator` compatible with Expo SDK 57.
- Implemented appointments data layer in `mobile/src/lib/supabase/appointments.ts` including `getAppointments(userId)`, `getSacramentRequirements(sacramentType, churchId)`, `checkSlotAvailability(churchId, date, time, sacramentType)`, `createAppointment(appointmentData, uploadedDocuments)`, `cancelAppointment(appointmentId, reason)`, and TanStack Query hooks.
- Built `mobile/src/components/appointments/DocumentUploader.tsx` supporting camera capture, gallery selection, and PDF attachment with client-side image compression (<200KB via `expo-image-manipulator`) and dual-bucket fallback support.
- Built multi-step booking wizard in `mobile/app/appointments/book.tsx` (Parish & Sacrament selection, 14-day date & time slot picker with real-time slot checking, requirement checklist with document uploaders, and contact/intention confirmation).
- Enhanced "My Appointments" screen in `mobile/app/(tabs)/appointments/index.tsx` with Upcoming vs History tabs, pull-to-refresh, status chips (`pending`, `approved`, `rejected`, `rescheduled`, `completed`, `cancelled`), inspection modal with uploaded documents and admin feedback, and appointment cancellation.
- Verified zero TypeScript errors (`npx tsc --noEmit`) and successful Hermes Android export (`npx expo export --platform android`).

