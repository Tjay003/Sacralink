# Issue 05: Priest-Schedule Aware AI Recommender

Type: feature
Status: proposed
Blocked by: 

---

## 1. Description
The AI in appointment booking should inspect priest availability. When a user requests an appointment or chooses a priest, if that priest is unavailable at the selected date/time, the AI must intelligently suggest:
1. **Option A (Same Church)**: Another available priest within the same church who can preside.
2. **Option B (Nearby Church)**: An available priest from another church in the diocese that fits the user's intended date and time.

To solve this:
1. In `BookAppointmentPage.tsx`, allow selecting a preferred priest or view the designated priest for the selected sacrament slot.
2. Enhance `recommender.ts` to detect priest schedule conflicts (checking conflicting appointments, mass schedules, and priest off-days).
3. If a conflict occurs, generate dual smart recommendation cards:
   - **Card A (Alternative Priest in Parish)**: Shows next available time for that priest OR another available priest in the same parish at the requested time.
   - **Card B (Available Priest in Nearby Diocese Parish)**: Shows the nearest active parish with an available priest offering that sacrament on the user's desired date/time.
4. Auto-filling on clicking "Select This Alternative" smoothly updates both church and priest assignments.

### Files Involved
- [web/src/pages/appointments/BookAppointmentPage.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/appointments/BookAppointmentPage.tsx)
- [web/src/lib/recommender.ts](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/recommender.ts)
- [web/src/lib/supabase/appointments.ts](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/supabase/appointments.ts)

---

## 2. Acceptance Criteria
- [ ] Appointment booking detects when a priest has a schedule collision.
- [ ] Smart Recommender renders priest alternative recommendations (same church vs. nearby church).
- [ ] Clicking an alternative recommendation auto-populates the booking form.
- [ ] Builds and passes TypeScript validation cleanly (`tsc -b`).
