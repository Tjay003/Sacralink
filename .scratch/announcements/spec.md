# Spec: Unified Announcements Subsystem & Live Route

## 1. Problem Statement
The current announcement system suffers from three architectural flaws:
1. [`web/src/pages/announcements/AnnouncementsPage.tsx`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/announcements/AnnouncementsPage.tsx) is a static mock view with hardcoded empty state.
2. Real announcements are split between two shallow hooks (`useChurchAnnouncements.ts` and `useSystemAnnouncements.ts`).
3. Management widgets duplicate Supabase delete/insert queries and lack unified real-time synchronization.

## 2. Desired State
- A deep domain module at [`web/src/lib/supabase/announcements.ts`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/supabase) providing unified querying, pinning priority, auto-expiration filtering, CRUD operations, and realtime subscriptions.
- A fully functional [`AnnouncementsPage.tsx`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/announcements/AnnouncementsPage.tsx) displaying system banner announcements, church announcements, search/filtering, and modal creation/editing triggers.
- Reusable UI widgets consolidated without duplicated database logic.

## 3. Scope & Tickets
1. `01-create-announcements-module`: Implement `web/src/lib/supabase/announcements.ts` deep domain module.
2. `02-wire-announcements-page`: Refactor `AnnouncementsPage.tsx` with live data, search, parish filters, and modals.
3. `03-consolidate-announcement-widgets`: Refactor `SystemAnnouncementsBanner`, `ChurchAnnouncementsManagement`, and `ChurchAnnouncementsWidget` to use the unified module.
