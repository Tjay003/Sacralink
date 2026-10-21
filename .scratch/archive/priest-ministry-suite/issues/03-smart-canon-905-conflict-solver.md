# Issue 03: Smart Canon 905 Conflict Solver & Assignment

Type: task
Status: resolved
Blocked by: 01

---

## 1. Description
Integrate canonical and temporal multi-constraint validation into the celebrant assignment workflow in `ApproveAppointmentModal.tsx` and the appointment approval lifecycle.

### Background (Canon Law & Operational Rules):
* **Canon 905 (§1 & §2)**: A priest may celebrate only one Mass a day, except when pastoral necessity allows celebration of two Masses on weekdays, or up to three Masses on Sundays and holy days of obligation (bination/trination).
* **Temporal Overlap**: A priest cannot celebrate a sacrament at the exact same hour as another scheduled ceremony.
* **Blackout / Day Off**: A priest cannot be assigned on his recorded day-off or during a diocesan retreat.

### Requirements:
1. **Constraint Evaluation Helper (`web/src/lib/liturgicalScheduler.ts`)**:
   - `evaluateCelebrantAssignment(priestId: string, appointmentDate: string, appointmentTime: string, churchId: string)`:
     - Checks `priest_availability` for blackout periods or weekly day-off.
     - Checks active `appointments` on `appointmentDate` for temporal time conflicts.
     - Checks daily Mass celebration count against Canon 905 thresholds (max 2 on weekdays, max 3 on Sundays/Holy Days).
     - Returns `{ eligible: boolean; warnings: string[]; recommendedAlternativePriestId?: string }`.
2. **ApproveAppointmentModal Integration**:
   - In `ApproveAppointmentModal.tsx`, as the secretary selects a celebrant from the dropdown:
     - Realtime indicator next to priest's name: `🟢 Available`, `⚠️ 2 Masses already scheduled`, `🔴 On Retreat / Unavailable`.
     - Displays human-readable conflict explanation if an unavailable priest is selected.
     - Suggests the best available priest in the parish with the lightest liturgical load.

---

## 2. Acceptance Criteria
- [x] Multi-constraint validation function implemented and tested.
- [x] `ApproveAppointmentModal.tsx` displays availability badges and Canon 905 warnings.
- [x] Smart recommendations suggest the least loaded available priest.
- [x] `npm --prefix web run build` compiles cleanly with zero errors.

