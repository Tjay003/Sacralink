# 04: Auto-provision church Staff Channels and fix new church visibility in Messages for staff and Super Admin

Type: task
**Blocked by:** None (can start immediately)
**Status:** completed

**What to build:** Fix all root causes preventing newly created churches and their staff (`church_admin`, `priest`, `volunteer`) from showing up in `/messages` (both in the **Staff** tab and in the **New Direct Conversation** modal):

1. **Database Migration (`supabase/migrations/087_auto_provision_staff_channels_and_contacts.sql`)**:
   - Create a `SECURITY DEFINER` function `public.ensure_church_staff_channel(p_church_id uuid) RETURNS uuid` that:
     - Verifies the caller is authenticated and is either `super_admin` or staff (`church_admin`, `priest`, `volunteer`) assigned to `p_church_id` (or called internally from triggers/`set_user_role`).
     - Finds or creates the `type = 'channel'` conversation row in `public.conversations` for `p_church_id` (titled `<Church Name> — Staff`).
     - Syncs all active staff (`role IN ('church_admin', 'priest', 'volunteer')` and `archived_at IS NULL AND deleted_at IS NULL` where `p_church_id IN (assigned_church_id, church_id)`) into `public.conversation_participants` for that channel (and adds `super_admin` when `super_admin` opens it).
     - Returns the channel's `conversation_id`.
   - Add an `AFTER INSERT` trigger on `public.churches` and update `public.set_user_role` / `public.approve_parish_application` so creating a church or assigning any staff role automatically provisions and syncs that church's Staff Channel.
   - Backfill all existing active churches in the migration so every church immediately has its Staff Channel and staff participants synced.
   - Update `public.can_initiate_direct_message` / `public.list_direct_contacts` so:
     - `super_admin` can see and message all staff (`church_admin`, `priest`, `volunteer`) of any church (so a newly created church with a `priest` or `volunteer` is never hidden in the church filter).
     - Staff of a church (`church_admin`, `priest`, `volunteer`) can always see and message all fellow staff (`church_admin`, `priest`, `volunteer`) of their own church (`COALESCE(assigned_church_id, church_id)`).
2. **Frontend Messaging Updates (`web/src/lib/supabase/messaging.ts` & `web/src/pages/messages/MessagingPage.tsx`)**:
   - Update `getOrCreateChurchStaffChannel(churchId)` in `messaging.ts` to call `supabase.rpc('ensure_church_staff_channel', { p_church_id: churchId })` first so `priest` and `volunteer` users never fail RLS when opening a new church's Staff Channel.
   - In `fetchUserConversations` (`messaging.ts`), ensure `super_admin` also loads all church `type = 'channel'` conversations so new churches appear in Super Admin's **Staff** tab without requiring manual creation first.
   - In `MessagingPage.tsx`, re-fetch `allChurches` (`directFetchChurches()`) whenever the `"New Direct Conversation"` modal or `"Parish Staff Channel"` picker modal opens so newly added churches appear immediately without a full page reload.

## Acceptance Criteria
- [x] Creating a new church and assigning a `church_admin`, `priest`, or `volunteer` automatically creates the church's Staff Channel (`type = 'channel'`) and enrolls its staff.
- [x] Logging in as a `priest`, `volunteer`, `church_admin`, or `super_admin` shows the new church's Staff Channel under the **Staff** tab on `/messages`, and clicking `"Staff channel"` opens it without RLS errors.
- [x] Opening `"New Direct Conversation"` on `/messages` shows the newly created church in the parish dropdown and lists its assigned staff (`church_admin`, `priest`, `volunteer`).
- [x] Verified against local Docker Supabase (`web/e2e-local`), and `tsc -b` + `vite build` pass cleanly.
