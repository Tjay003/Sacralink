# Issue 03: Appointment Approval Modal with Priest Picker

Type: task
Status: resolved
Blocked by: 02

---

## 1. Description
When approving an appointment in `AppointmentsPage.tsx`, church administrators currently have no mechanism to designate a presiding priest or provide pastoral instructions.

`appointments.priest_id` and `appointments.admin_feedback` already exist in the database schema. This ticket wires them up to a user-friendly approval modal.

### Requirements:
1. **Modal Component (`ApproveAppointmentModal.tsx`)**:
   - Triggered when Church Admin clicks "Approve" on any pending appointment.
   - **Celebrant Dropdown**:
     - Lists all active priests belonging to `appointment.church_id`:
       Users where `role = 'priest' OR (role = 'church_admin' AND is_priest = true)`.
     - Displays formatted option: `"Fr. [Full Name]"`.
     - Includes default option: **`"None / Unassigned (Parish Pool)"`** (`value: null`).
   - **Admin Feedback / Instructions**:
     - Optional textarea for instructions to the parishioner (e.g. *"Please bring original PSA birth certificate to parish office 3 days prior."*).
2. **Domain Seam (`appointments.ts`)**:
   - Update `updateAppointmentStatus(id, 'approved', { priestId, adminFeedback, ... })`.
   - Update `HydratedAppointment` interface to include `priest?: { id: string; full_name: string } | null` and `admin_feedback?: string | null`.
3. **In-App Notification (`notifications.ts`)**:
   - If `priestId` is selected, send an in-app notification to the assigned priest:
     *"You have been assigned as celebrant for a [Sacrament] on [Date] at [Time]."*
4. **Parishioner Card UI**:
   - On the appointment card, render a clergy badge:
     - If assigned: `Celebrant: Fr. [Name]`
     - If unassigned: `Celebrant: Parish Clergy`
   - If `admin_feedback` exists, display it under a "Note from Parish Office" box.

---

## 2. Acceptance Criteria
- [x] Clicking "Approve" opens `ApproveAppointmentModal.tsx`.
- [x] Dropdown displays eligible priests for that church plus the "None / Unassigned" default.
- [x] Submitting updates `priest_id` and `admin_feedback` in Supabase.
- [x] Assigned priest receives an in-app notification.
- [x] Parishioner appointment cards display the celebrant badge and remarks.
- [x] `npx tsc -b` compiles with 0 errors.

## 3. Resolution Details
1. Created `web/src/components/appointments/ApproveAppointmentModal.tsx`:
   - Connects to `getChurchPriests(churchId)` to load eligible parish celebrants.
   - Preserves "None / Unassigned (Parish Pool)" fallback option.
   - Includes appointment metadata summary preview and optional admin feedback / instructions textarea.
   - Built to match SacraLink's Faith Blue / Sacred Gold design tokens.
2. Updated `web/src/lib/supabase/appointments.ts`:
   - Updated `HydratedAppointment` and `RawAppointmentQueryResult` to include `priest_id`, `admin_feedback`, and hydrated `priest: { id, full_name, email }`.
   - Updated `getAppointments` and `getAppointmentById` to join `priest:profiles!appointments_priest_id_fkey(id, full_name, email)`.
   - Extended `updateAppointmentStatus` to accept `priestId`, `adminFeedback`, `appointmentDate`, and `appointmentTime` in metadata and persist them to `appointments`.
   - Dispatches in-app notification to the assigned priest upon confirmation.
3. Updated `web/src/lib/supabase/notifications.ts`:
   - Enhanced `createNotification` to accept `user_id` / `userId` and `entity_id` / `entityId`.
4. Updated `web/src/types/database.ts`:
   - Added `priest_id`, `admin_feedback`, and `appointments_priest_id_fkey` relationship definitions to the `appointments` table schema for end-to-end type safety.
5. Updated `web/src/pages/appointments/AppointmentsPage.tsx`:
   - Replaced simple confirmation modal on "Approve" with `ApproveAppointmentModal`.
   - Rendered celebrant badge (`Celebrant: Fr. [Name]` or `Celebrant: Parish Clergy`) on appointment cards.
   - Added "Note from Parish Office" display box for appointments with `admin_feedback`.
6. Verified with `npx tsc -b` (0 errors) and `npm run build` (successful compilation).
