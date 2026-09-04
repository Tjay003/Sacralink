# Issue 10: Super Admin Mobile System Overview & Parish Onboarding

Type: task  
Status: ready-for-agent  
Blocked by: 02, 08  

---

## 1. Description
Build the Super Admin mobile management interface for monitoring diocesan system metrics, reviewing and approving/rejecting new parish onboarding applications, managing user roles, and publishing diocese-wide announcements.

---

## 2. Acceptance Criteria
- [ ] Super Admin Metrics Overview (`app/(tabs)/super-admin/index.tsx`): Total registered parishes, total appointments this month, active users.
- [ ] Parish Applications Review screen (`app/super-admin/applications.tsx`): List pending parish applications, view submitted accreditation proofs, and trigger Approve / Reject.
- [ ] User Role Management screen (`app/super-admin/users.tsx`): Search users, edit role (`user`, `church_admin`, `priest`, `super_admin`), and assign churches.
- [ ] System Announcement publisher form.

---

## 3. Implementation Steps
1. Create `mobile/src/lib/supabase/superAdmin.ts`.
2. Build `app/(tabs)/super-admin/index.tsx` dashboard.
3. Build `app/super-admin/applications.tsx` and `app/super-admin/users.tsx`.
