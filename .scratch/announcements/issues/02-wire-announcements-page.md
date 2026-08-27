# 02 - Wire Live Announcements Page

Status: resolved
Type: task
Blocked by: 01

## Description
Refactor `web/src/pages/announcements/AnnouncementsPage.tsx` from its current empty mock view into a full-featured announcements hub:
- Role-aware tabs/views (System & Church announcements).
- Realtime search and parish filtering (for Super Admin and users).
- Modal triggers for "New Announcement" (using `AnnouncementForm.tsx` and centralized `Modal`).
- Click-to-view detail modal with `AnnouncementDetailModal.tsx`.
- Delete confirmation flow with `ConfirmationModal.tsx`.

## Acceptance Criteria
- Zero mock UI / placeholder states when data exists.
- Real-time updates automatically reload the announcement feed.
- Responsive cards with pinned badges, target church tags, and date stamps.

## Resolution
- Transformed `AnnouncementsPage.tsx` into a full-featured, role-aware announcements hub:
  - Added role-aware tabs for "All Announcements", "Parish Announcements", and "System Notices" with live count badges.
  - Implemented real-time debounced search bar and parish filter dropdown (locked to assigned church for church admins, filterable for super admins and parishioners).
  - Integrated "New Announcement" button and modal workflow utilizing `AnnouncementForm.tsx` with church selection support for Super Admins.
  - Integrated `ConfirmationModal.tsx` for delete flows calling `deleteChurchAnnouncement` and `deleteSystemAnnouncement` domain APIs.
  - Added real-time subscription via `subscribeToAnnouncements` with automatic feed refreshes.
  - Enhanced `AnnouncementCard.tsx`, `AnnouncementDetailModal.tsx`, `AnnouncementsList.tsx`, and `AnnouncementForm.tsx` with complete domain typing and zero `as any` casts.
  - Verified with `npm --prefix web run build` (0 TypeScript/Vite errors) and `npx eslint` (0 lint errors).
