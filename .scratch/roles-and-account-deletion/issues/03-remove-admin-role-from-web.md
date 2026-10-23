# 03: Remove the Admin role from the web app

Type: task
Status: ready-for-agent
**Blocked by:** 02

**What to build:** Remove every web-side use of `role === 'admin'` so the app has Super Admin, Church Admin, Priest, Volunteer and Parishioner only. About 60 occurrences in these files (`grep -rn "'admin'" web/src`): `App.tsx`, `components/admin/EditRoleModal.tsx`, `components/appointments/ApproveAppointmentModal.tsx`, `components/dashboard/RecentActivityWidget.tsx`, `components/layout/DashboardLayout.tsx` (including `hiddenForDioceseAdmins`, `adminOnly`), `components/layout/Navbar.tsx`, `contexts/AuthContext.tsx` (`useIsAdmin` at ~541 and the `admin` branch at ~564), `hooks/useSidebarCounts.ts`, `lib/supabase/messaging.ts`, `lib/supabase/notifications.ts`, `lib/supabase/profiles.ts`, `pages/admin/KnowledgeBasePage.tsx`, `pages/admin/SystemAnnouncementsPage.tsx`, `pages/admin/UsersPage.tsx`, `pages/announcements/AnnouncementsPage.tsx`, `pages/appointments/AppointmentsPage.tsx`, `pages/churches/{AddChurchPage,ChurchDetailPage,ChurchesPage,EditChurchPage}.tsx`, `pages/dashboard/DashboardPage.tsx`, `pages/messages/MessagingPage.tsx`, `pages/ProfilePage.tsx`.

Rules while editing:
- Where the code said `['admin','super_admin']`, it becomes `['super_admin']`. Where it said `['admin','church_admin',...]` it drops `admin`.
- Rename the `isSuperOrDioceseAdmin` / `isDioceseAdmin` helpers to describe what is left (Super Admin), and delete `useIsAdmin` if nothing else needs it.
- The messaging admin channels ("Admin", "Admin Office", "Admins" labels from the earlier wording pass) become the Super Admin's channel; keep the labels sensible ("Super Admin"/"Admin Office" stays acceptable).
- Remove the `admin` option from `EditRoleModal` role lists and the role badge/color maps and filters in `UsersPage.tsx`.
- Do not touch the generated `UserRole` type's `admin` member (the enum value is dormant in the database); instead stop referencing it.
- `mobile/` is out of scope.

- [ ] `grep -rn "'admin'" web/src` returns only intentional leftovers (the generated type, if any), each justified in the PR note.
- [ ] A converted account (ticket 02) logs in as a Parishioner and sees the parishioner dashboard and sidebar.
- [ ] Super Admin and Church Admin sidebars, dashboards, messaging and announcements behave exactly as before.
- [ ] Typecheck and lint are clean.

**Test plan:** one test: log in as the converted admin account and assert it lands on the parishioner dashboard with no Management section. Re-run `messaging-privacy.spec.ts`, `volunteer-restrictions.spec.ts` and `mass-schedule-permissions.spec.ts` to catch role-branch regressions. Everything else is a removal; no new tests.
