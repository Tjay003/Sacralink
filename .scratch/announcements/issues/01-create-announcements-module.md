# 01 - Create Deep Announcements Domain Module

Status: ready-for-agent
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
