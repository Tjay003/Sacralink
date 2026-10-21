# 02: Remove Super Admin from Standard Role Pickers

Type: task
Status: resolved
Blocked by: 01

## Summary
Update frontend components to prevent assigning the `super_admin` role through ordinary edit role forms and dropdowns.

## Scope & Implementation Details
1. Update `web/src/components/admin/EditRoleModal.tsx`:
   - Adjust `availableRoles` so that `super_admin` is omitted for both Super Admins and Church Admins.
   - For Super Admins: `availableRoles = ['user', 'volunteer', 'church_admin', 'admin']`.
   - For Church Admins: `availableRoles = ['user', 'volunteer', 'church_admin']`.
   - If the user being edited is currently `super_admin`, disable editing role via this modal completely and show an informational banner indicating that Super Admin role can only be transferred, not reassigned.
2. Update filter options in `web/src/pages/admin/UsersPage.tsx` if needed to retain filtering by `super_admin`, but ensure any inline edit or creation forms do not expose `super_admin` as an assignable option.

## Acceptance Criteria
- [x] No role dropdown anywhere in the UI offers `super_admin` as a selectable choice.
- [x] Attempting to edit a user only permits standard roles (`admin`, `church_admin`, `volunteer`, `user`).
- [x] TypeScript types remain consistent with the database schema.

## Resolution
1. Updated `web/src/components/admin/EditRoleModal.tsx`:
   - Omitted `super_admin` from `availableRoles` across all admin roles (`['user', 'volunteer', 'church_admin', 'admin']` for Super Admins, `['user', 'volunteer', 'church_admin']` for Church Admins).
   - Added `isEditingSuperAdmin` guard to lock inputs and prevent role modifications on Super Admin accounts.
   - Added high-contrast informational banner explaining that platform ownership can only be transferred and not reassigned.
2. Verified `UsersPage.tsx` role filter maintains read-only filtering while ensuring standard edit controls do not offer `super_admin`.
3. Verified full TypeScript type safety with zero type errors.
