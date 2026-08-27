# Effort Map: Unified Announcements Subsystem

## Notes
- Feature branch / effort: `announcements`
- Tracker mode: Local Markdown (`.scratch/announcements/`)

## Tickets

- [x] **01**: [Create Deep Announcements Domain Module](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/.scratch/announcements/issues/01-create-announcements-module.md)
- [x] **02**: [Wire Live Announcements Page](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/.scratch/announcements/issues/02-wire-announcements-page.md) (Blocked by: none)
- [ ] **03**: [Consolidate Announcement Widgets & Deprecate Shallow Hooks](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/.scratch/announcements/issues/03-consolidate-announcement-widgets.md) (Blocked by: none)

## Decisions-so-far
- 2026-08-28: Adopted Local Markdown issue tracking in `.scratch/` to avoid external GitHub issue dependencies.
- 2026-08-28: Implemented `web/src/lib/supabase/announcements.ts` deep domain module unblocking tickets 02 & 03.
- 2026-08-28: Refactored `AnnouncementsPage.tsx` with role-aware tabs, realtime search, parish filtering, modal creation/edit flows, and delete confirmation via domain APIs.
