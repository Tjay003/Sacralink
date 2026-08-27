# 03 - Consolidate Announcement Widgets & Deprecate Shallow Hooks

Status: resolved
Type: task
Blocked by: 01

## Description
Refactor existing widgets to consume `web/src/lib/supabase/announcements.ts`:
- `web/src/components/announcements/SystemAnnouncementsBanner.tsx`
- `web/src/components/dashboard/ChurchAnnouncementsManagement.tsx`
- `web/src/components/dashboard/ChurchAnnouncementsWidget.tsx`
- `web/src/components/announcements/AnnouncementsList.tsx`
- Deprecate or wrap `useChurchAnnouncements.ts` and `useSystemAnnouncements.ts` to delegate directly to the deep module.

## Acceptance Criteria
- Zero raw `supabase.from('church_announcements')` or `supabase.from('system_announcements')` queries in UI components.
- Delete operations use the domain module's delete methods.
- Realtime channels managed consistently.

## Resolution
- Refactored `useChurchAnnouncements.ts` and `useSystemAnnouncements.ts` to delegate directly to domain fetchers (`getChurchAnnouncements`, `getSystemAnnouncements`) and subscriptions (`subscribeToChurchAnnouncements`, `subscribeToSystemAnnouncements`).
- Eliminated all raw `supabase.from('church_announcements')` and `supabase.from('system_announcements')` queries from UI components.
- Updated `ChurchAnnouncementsManagement.tsx`, `SystemAnnouncementsManagement.tsx`, `ChurchDetailPage.tsx`, and `SystemAnnouncementsPage.tsx` to use `deleteChurchAnnouncement` and `deleteSystemAnnouncement`.
- Enhanced type guards (`isChurchAnnouncement`, `isSystemAnnouncement`) and updated widgets (`ChurchAnnouncementsWidget.tsx`, `SystemAnnouncementsBanner.tsx`) to consume domain module types with 0 `as any` casts.
- Verified TypeScript checks and production build with `tsc -b && vite build` (0 errors) and ESLint (0 errors).

