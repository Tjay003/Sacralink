# Issue 11: In-Place Staff Assignment Modal & Clergy Management for Church Page

Type: feature
Status: resolved
Blocked by: 

---

## 1. Description
On `ChurchDetailPage.tsx`, under the **Parish Office & Clergy** card, the `+ Assign` button currently redirects to `/admin/users` (an obsolete path, as the correct path is `/users`), forcing the Super Admin away from the church they are configuring. Furthermore, assigned staff members listed on the card lack inline management actions (unassigning a member or modifying their parish role requires navigating away and searching through the global user list).

To solve this:
1. **In-Place Staff Assignment Modal (`AssignStaffModal.tsx`)**:
   - Clicking `+ Assign` opens a dedicated in-place modal without leaving the church view.
   - User Search: Search any registered user by name or email.
   - Role Selection: Assign role (`church_admin`, `priest`, or `volunteer`).
   - Clergy Toggle: If assigned as administrator, optionally mark as ordained priest (`is_priest`).
   - Direct Action: Saves assignment directly with `assigned_church_id = church.id` and immediately updates the parish roster.
2. **Inline Staff Member Action Menu**:
   - For each member listed under Parish Office & Clergy:
     - Provide an action dropdown menu (`...` or clean icon triggers):
       1. **Edit Assignment / Role**: Re-opens `EditRoleModal` pre-populated with that member's data.
       2. **Unassign from Church**: Prompts a confirmation dialog (*"Remove [Name] from [Church Name] office staff?"*). On confirm, clears their `assigned_church_id` (setting their role to general parishioner/user or keeping unassigned clergy status) and logs an audit trail.

### Files Involved
- [web/src/pages/churches/ChurchDetailPage.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/churches/ChurchDetailPage.tsx)
- [web/src/components/admin/AssignStaffModal.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/admin/AssignStaffModal.tsx)
- [web/src/components/admin/EditRoleModal.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/admin/EditRoleModal.tsx)
- [web/src/lib/directApi.ts](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/directApi.ts)

---

## 2. Acceptance Criteria
- [x] Clicking `+ Assign` opens `AssignStaffModal` directly on the Church Detail page (no redirect).
- [x] Super Admin can search existing users and assign them as Church Admin, Priest, or Volunteer to the active parish.
- [x] Each assigned staff member has an action menu with "Edit Assignment / Role" and "Unassign from Church".
- [x] Confirming unassignment clears `assigned_church_id` and refreshes the staff list in real time.
- [x] Builds cleanly and passes TypeScript validation (`tsc -b`).
