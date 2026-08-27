# 03 - Consolidate Announcement Widgets & Deprecate Shallow Hooks

Status: ready-for-agent
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
