# Issue 04: Church Clergy Directory & Real-Time Status

Type: feature
Status: proposed
Blocked by: 

---

## 1. Description
Parishioners and visitors visiting a specific Church's page should be able to view the priests assigned to that parish and their availability status (e.g., Parish Priest, Parochial Vicar, Available for Appointment, Presiding Mass, On Leave).

To solve this:
1. Query profiles where `assigned_church_id = church.id` and (`is_priest = true` or `user_role = 'priest'`).
2. Add a dedicated "Parish Clergy" section or tab in `ChurchDetailPage.tsx`.
3. Display clergy profile card with:
   - Full Name (with ecclesiastical title e.g. "Rev. Fr. ...")
   - Role / Designation (Parish Priest, Resident Priest, Guest Celebrant)
   - Real-time availability badge (Available for Appointment, In Mass, On Leave)
   - Direct shortcut button to "Request Spiritual Consultation" or "Book with Father".

### Files Involved
- [web/src/pages/churches/ChurchDetailPage.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/churches/ChurchDetailPage.tsx)
- [web/src/lib/supabase/profiles.ts](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/supabase/profiles.ts)
- [web/src/types/database.ts](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/types/database.ts)

---

## 2. Acceptance Criteria
- [ ] Church detail page renders an ecclesiastical clergy roster for the viewed parish.
- [ ] Priests display appropriate status badges (*Available, On Leave, In Mass*).
- [ ] Clean layout conforming to SacraLink Light Theme design system tokens.
- [ ] Builds and passes TypeScript validation cleanly (`tsc -b`).
