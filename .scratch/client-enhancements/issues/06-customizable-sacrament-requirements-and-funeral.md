# Issue 06: Customizable Sacrament Requirements & Funeral Template

Type: feature
Status: proposed
Blocked by: 

---

## 1. Description
Different parishes have different sacrament requirement policies. While a diocesan baseline exists, churches need the autonomy to customize their checklists. Additionally, the Funeral service type must include the baseline "Death Certificate" requirement by default.

To solve this:
1. **Funeral Baseline Template**:
   - Update `seedDefaultRequirements` in `web/src/lib/supabase/requirements.ts` to include `service_type: 'funeral'`, `requirement_name: 'Death Certificate'`, `is_required: true`.
2. **Church Admin Sacrament Requirements Manager**:
   - Provide a clean management interface (e.g. within Church Admin Dashboard or Edit Church / Sacrament Settings) allowing church administrators to:
     - ➕ Add a new requirement (Name, Description, Toggle Required/Optional).
     - ✏️ Edit an existing requirement name or toggle required status.
     - 🗑️ Delete/Remove requirements not enforced by their parish.
3. **Dynamic Booking Form Validation**:
   - Verify that `BookAppointmentPage.tsx` dynamically renders the exact requirement fields saved for that church and enforces mandatory document uploads before submission.

### Files Involved
- [web/src/lib/supabase/requirements.ts](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/supabase/requirements.ts)
- [web/src/pages/appointments/BookAppointmentPage.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/appointments/BookAppointmentPage.tsx)
- [web/src/components/churches/SacramentRequirementsManager.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/churches/SacramentRequirementsManager.tsx)
- [web/src/pages/dashboard/ChurchAdminDashboard.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/dashboard/ChurchAdminDashboard.tsx)

---

## 2. Acceptance Criteria
- [ ] Funeral sacrament includes default "Death Certificate" requirement.
- [ ] Church Admins have a working UI to add, edit, and delete sacrament requirements for their church.
- [ ] Booking appointment page dynamically displays the customized requirements for the chosen church.
- [ ] Builds and passes TypeScript validation cleanly (`tsc -b`).
