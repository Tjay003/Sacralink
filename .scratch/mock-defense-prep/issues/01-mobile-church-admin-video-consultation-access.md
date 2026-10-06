# Issue 01: Mobile Church Admin Video Consultation Access

Type: task
Status: resolved
Blocked by: 

---

## 1. Description
The parish priest operates under the role `church_admin` in SacraLink. However, in the mobile app, the pastoral video consultation screen (`mobile/app/(tabs)/priest/consultations.tsx`) is currently only linked under the hidden `priest` tab.

To allow the Church Admin / Priest to host virtual pastoral counseling:
1. In `mobile/app/(tabs)/admin/index.tsx` (Parish Hub), add a dedicated action card / tile: **"Pastoral Video Consultations"** navigating to `/priest/consultations`.
2. In `mobile/src/components/admin/AdminAppointmentCard.tsx`, add a **"Launch Video Consultation"** button when the appointment service type involves counseling, spiritual direction, or virtual meetings, linking directly to the consultation video room.

---

## 2. Acceptance Criteria
- [x] Parish Hub (`admin/index.tsx`) includes a visible Pastoral Video Consultation action button for `church_admin`.
- [x] `AdminAppointmentCard.tsx` provides a direct launch button for virtual counseling appointments.
- [x] `npx tsc --noEmit` in `mobile/` passes with 0 errors.

---

## 3. Resolution Details
1. **Parish Hub Action Shortcut Added:**
   - Modified [mobile/app/(tabs)/admin/index.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/mobile/app/(tabs)/admin/index.tsx) to import `Video` from `lucide-react-native`.
   - Added a dedicated "Pastoral Video Consultations" quick-action card in the Parish Operations & Shortcuts section routing to `/priest/consultations`.
2. **Admin Appointment Card Video Launch:**
   - Modified [mobile/src/components/admin/AdminAppointmentCard.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/mobile/src/components/admin/AdminAppointmentCard.tsx) to import `useRouter` and `Video`.
   - Added `isVirtualConsultation` inspection logic detecting counseling, spiritual direction, consultation, confession, or notes with virtual/video.
   - Added "Virtual" badge in card header, "Join Video Call" button on outer card, and "Join Video Call" modal action button directly routing to `/priest/consultations`.
3. **Verification:**
   - Executed `npx tsc --noEmit` in `mobile/`, verifying 0 TypeScript errors.
