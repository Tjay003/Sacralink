# 02 - Wire Live Announcements Page

Status: ready-for-agent
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
