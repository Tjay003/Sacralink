# 01 - Create Deep Announcements Domain Module

Status: resolved
Type: task
Blocked by: none

## Description
Create `web/src/lib/supabase/announcements.ts` containing:
- Unified types: `ChurchAnnouncement`, `SystemAnnouncement`, `UnifiedAnnouncement`
- Functions:
  - `getChurchAnnouncements(churchId?: string, options?: { search?: string; limit?: number })`
  - `getSystemAnnouncements()`
  - `getAllAnnouncements(options?: { churchId?: string; search?: string })`
  - `deleteChurchAnnouncement(id: string)`
  - `deleteSystemAnnouncement(id: string)`
  - `subscribeToAnnouncements(churchId: string | undefined, onUpdate: () => void): () => void`

## Acceptance Criteria
- Full TypeScript typing without `as any` casts.
- Pinned announcements ranked first, followed by newest `created_at`.
- Active system announcement filtering (`expires_at.is.null` or `expires_at > now`).
- Self-contained Supabase Realtime channel subscription with teardown.

## Resolution
Implemented `web/src/lib/supabase/announcements.ts` with:
- Full TypeScript domain definitions for `ChurchAnnouncement`, `SystemAnnouncement`, `UnifiedAnnouncement`, `AnnouncementCategory`, and `SystemAnnouncementType`.
- Type guards: `isChurchAnnouncement`, `isSystemAnnouncement`.
- Query functions: `getChurchAnnouncements`, `getSystemAnnouncements`, and `getAllAnnouncements` with search, limit, and active/expiration filtering.
- Ranking algorithm: `rankAnnouncements` ranking pinned announcements first, followed by newest `created_at` descending.
- Mutation functions: `deleteChurchAnnouncement`, `deleteSystemAnnouncement`, `createChurchAnnouncement`, `updateChurchAnnouncement`, `createSystemAnnouncement`, `updateSystemAnnouncement`.
- Realtime channels: `subscribeToAnnouncements`, `subscribeToChurchAnnouncements`, `subscribeToSystemAnnouncements` with teardown functions.
- Verified TypeScript compilation and zero ESLint issues.
