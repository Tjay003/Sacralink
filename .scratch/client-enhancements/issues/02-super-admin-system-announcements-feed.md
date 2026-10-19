# Issue 02: Super Admin System Announcements Public Feed

Type: feature
Status: resolved
Blocked by: 

---

## 1. Description
Super Admin system announcements (diocesan decrees, maintenance advisories, Holy Week circulars) must be visible and prominent to all users (parishioners and visitors), not just administrative staff.

To solve this:
1. Ensure `SystemAnnouncementsBanner.tsx` is mounted on the primary Parishioner Dashboard ([web/src/pages/dashboard/DashboardPage.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/dashboard/DashboardPage.tsx) and [web/src/pages/dashboard/UserDashboard.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/dashboard/UserDashboard.tsx)).
2. Provide a clear "Diocese Advisories" tab or section on the public Announcements Page ([web/src/pages/announcements/AnnouncementsPage.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/announcements/AnnouncementsPage.tsx)) so parishioners can browse all active Super Admin notices.
3. Verified RLS policies on `system_announcements` allow public/authenticated read access for active records (`is_active = true AND (expires_at IS NULL OR expires_at > NOW())`).

### Changes Completed
- Verified and ensured `<SystemAnnouncementsBanner />` is mounted at the top of the user dashboard feed (`UserDashboard.tsx` and `DashboardPage.tsx`), allowing regular parishioners and visitors to see active Super Admin notices.
- Updated `AnnouncementsPage.tsx` with a prominent "Diocese Advisories" tab so parishioners have instant access to system advisories alongside parish announcements.
- Verified `AnnouncementsList.tsx` and `AnnouncementDetailModal.tsx` allow regular users to view the complete text and metadata of system announcements without administrative permission requirements.
- Validated RLS policy "Public can read active system announcements" in migration 021 and added `system_announcements` to logical realtime publication in migration 039.

### Files Involved
- [web/src/components/announcements/SystemAnnouncementsBanner.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/announcements/SystemAnnouncementsBanner.tsx)
- [web/src/pages/announcements/AnnouncementsPage.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/announcements/AnnouncementsPage.tsx)
- [web/src/pages/dashboard/DashboardPage.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/dashboard/DashboardPage.tsx)
- [web/src/pages/dashboard/UserDashboard.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/dashboard/UserDashboard.tsx)
- [web/src/lib/supabase/announcements.ts](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/supabase/announcements.ts)

---

## 2. Acceptance Criteria
- [x] Regular parishioners see Super Admin system announcement banners on their dashboard.
- [x] Announcements page clearly lists Super Admin diocesan announcements to all authenticated users.
- [x] Builds and passes TypeScript validation cleanly (`tsc -b`).
