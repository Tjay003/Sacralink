# Issue 02: Celebrant Attention Queue Widget

Type: task
Status: resolved
Blocked by: none

---

## 1. Description
Reusing the proven architectural pattern of `ParishAttentionWidget.tsx`, create a dedicated `CelebrantAttentionWidget.tsx` tailored for Father's liturgical and pastoral queue.

### Requirements:
1. **Component**: `web/src/components/dashboard/CelebrantAttentionWidget.tsx`.
2. **Behavior**:
   - Queries `appointments` where `priest_id = auth.uid()` and status is active (`approved` or `pending`).
   - Surfaces high-priority actionable items:
     - **Sacrament Document Checks**: Ceremonies where required certificates (e.g. PSA birth certificate for Baptism, CENOMAR for Wedding) need Father's review before the ceremony.
     - **Pastoral Counseling**: Scheduled spiritual guidance sessions.
     - **Pre-Nuptial Inquiries**: Canonical examinations with engaged couples.
   - For each item, provides quick action triggers:
     - `Review Certificate` (opens `DocumentViewerModal`)
     - `Message Parishioner` (routes to `/messages` with that user)
     - `View Details` (opens appointment details)
   - When the queue is clear: renders a calm, green status banner: *"Your celebrant queue is clear · No pending documents requiring your review."*

---

## 2. Acceptance Criteria
- [x] `CelebrantAttentionWidget.tsx` created and styled matching the SacraLink design system (`rounded-2xl`, crisp badges).
- [x] Connects to Supabase realtime channels to update instantly when documents are uploaded or appointments are scheduled.
- [x] Compact empty state rendered cleanly when zero items need attention.
- [x] Static validation passes with `npm --prefix web run build`.

