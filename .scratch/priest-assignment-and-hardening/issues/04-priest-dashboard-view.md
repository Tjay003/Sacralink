# Issue 04: Priest Dashboard View

Type: task
Status: resolved
Blocked by: 02, 03

---

## 1. Description
Currently, when a user with `role = 'priest'` logs into SacraLink, `DashboardPage.tsx` falls through to a generic volunteer view with non-pastoral widgets.

Priests need a focused liturgical dashboard displaying their assigned sacraments, daily Mass intentions, and parish appointments.

### Requirements:
1. **Priest Dashboard Component (`PriestDashboard.tsx`)**:
   - Location: `web/src/pages/dashboard/PriestDashboard.tsx`.
   - Connected in `DashboardPage.tsx`:
     ```tsx
     if (profile?.role === 'priest') {
         return <PriestDashboard churchId={profile.assigned_church_id} />;
     }
     ```
   - **Key Liturgical Sections**:
     - **Welcome Banner**: *"Welcome, Father [Name]! Liturgical Calendar for [Date]."*
     - **Today's Assigned Sacraments**: Card list of ceremonies where `priest_id = auth.uid()` and `appointment_date = today`.
     - **Upcoming Presided Ceremonies**: Filterable view (Baptisms, Weddings, Funerals, Confessions) with dates, times, and parishioner contact names.
     - **Document Quick-View**: Button to view submitted sacrament certificates (e.g. PSA birth certificates, baptism certificates) for ceremonies Father will preside over.
2. **Church Admin Combo Support**:
   - If a user is `role === 'church_admin'` AND `is_priest === true`, add a quick toggle or prominent tab in `ChurchAdminDashboard.tsx`: **"My Celebrant Schedule"**, embedding Father's personal assignments.

---

## 2. Acceptance Criteria
- [x] Users logged in as `role = 'priest'` are directed to `PriestDashboard.tsx`.
- [x] Priest dashboard renders upcoming assigned sacraments filtered by `priest_id = auth.uid()`.
- [x] Clicking an assigned appointment allows Father to view parishioner documents and details.
- [x] Church Admins with `is_priest = true` have access to their personal celebrant schedule tab.
- [x] `npx tsc -b` compiles with 0 errors.

## 3. Comments

## 4. Resolution Details
1. **Created `web/src/pages/dashboard/PriestDashboard.tsx`**:
   - Accepts `churchId?: string | null`.
   - Queries `appointments` where `priest_id = auth.uid()` and `status IN ('approved', 'completed')`, ordered chronologically by `appointment_date` and `appointment_time`.
   - Features Clergy Welcome Header ("Welcome, Fr. [Name]" with today's date and rotating daily liturgical reflection quotes).
   - Features Stat Cards for Today's Ceremonies, Upcoming Sacraments, and Completed Celebrations.
   - Features High-Priority Today's Liturgical Schedule with prominent celebrant cards.
   - Features Filterable and searchable assigned sacraments list (filter by sacrament type, status, and keywords).
   - Features Celebrant Document Inspection Modal (`Sacramental Document Inspection`) enabling Father to review parishioner details, contact information, ceremony intentions, and preview/download prerequisite requirement documents.
2. **Updated `web/src/pages/dashboard/DashboardPage.tsx`**:
   - Added routing rule directing users with `profile?.role === 'priest'` to `<PriestDashboard churchId={profile.assigned_church_id || null} />`.
3. **Updated `web/src/pages/dashboard/ChurchAdminDashboard.tsx`**:
   - Added tab switcher ("Parish Operations" vs. "My Celebrant Schedule") for church administrators with `profile?.is_priest === true`.
   - Embeds `<PriestDashboard churchId={churchId} />` seamlessly when the tab is toggled.
4. **Enhanced `web/src/lib/supabase/appointments.ts`**:
   - Added `priestId?: string | null` and `statusIn?: AppointmentStatus[]` to `GetAppointmentsFilter`.
   - Included parishioner `phone_number` in hydrated appointment profile queries.
   - Enhanced `subscribeToAppointments` to listen for realtime changes on `priest_id`.
5. **Static Validation**:
   - `npx tsc -b` executed with 0 errors.
   - `npm run build` completed cleanly with production bundle generated.
