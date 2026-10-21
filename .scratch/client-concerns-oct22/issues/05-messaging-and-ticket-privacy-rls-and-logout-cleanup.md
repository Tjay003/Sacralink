# 05: Messaging and Parish Office Ticket privacy RLS, Staff Channel role filtering, and logout cache cleanup

Type: task
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

**What to build:** Fix the cross-account chat history leak on logout/login and enforce strict privacy for 1-on-1 Direct Messages, Parish Staff Channels, and Parish Office Tickets at both the client storage seam and the Supabase RLS seam (see ADR 0002):

1. **Clear local ministry conversation caches on logout & scope by user ID**:
   - On `signOut()` in `AuthContext`, clear `sacralink_local_ministry_convs` and all `sacralink_local_ministry_messages_*` keys from `localStorage` and `sessionStorage`.
   - Scope any local ministry conversation fallback reads/writes in `messaging.ts` by the authenticated `user.id` so switching accounts in the same browser never merges another user's cached conversations.
2. **Prevent Parishioners from being added to the Parish Staff Channel**:
   - In `getOrCreateChurchStaffChannel`, filter the `profiles` query with `.in('role', ['church_admin', 'priest', 'volunteer'])` (and check both `assigned_church_id` and `church_id` only for those staff roles) so regular parishioners (`role = 'user'`) are never added as participants in a parish's internal Staff Channel.
3. **Database Migration (`057`) for Strict Conversation & Message Privacy**:
   - Clean up any existing `conversation_participants` rows in Parish Staff Channels (`title ILIKE '%Staff Channel%'` or `subject = 'parish_staff_channel'`) where the participant's profile has `role = 'user'`.
   - Replace the `conversations` and `messages` SELECT RLS policies (dropping both `"Users can view their conversations"` and `"Users can view conversations they participate in"`) so:
     - **1-on-1 Direct Messages** (`COALESCE(is_ticket, false) = false` and not a Parish Staff Channel): visible **strictly** to users in `conversation_participants` for that conversation—no `super_admin` or `church_admin` override.
     - **Parish Staff Channels**: visible only to `church_admin`, `priest`, and `volunteer` assigned to `conversations.church_id` (or in `conversation_participants` with a staff role).
     - **Parish Office Tickets** (`is_ticket = true`): visible to the requesting parishioner (in `conversation_participants`) and to `church_admin` / `volunteer` assigned to `conversations.church_id` (plus the claiming staff handler in `conversation_participants`).

- [ ] Logging out of User A and logging into User B on the same browser shows zero conversations or messages from User A.
- [ ] `getOrCreateChurchStaffChannel` only enrolls `church_admin`, `priest`, and `volunteer` profiles for that parish and never enrolls `role = 'user'`.
- [ ] Local Supabase RLS test (`web/e2e-local/`) proves that a 1-on-1 Direct Message between two users cannot be read by another user, a `church_admin`, or a `super_admin`.
- [ ] Local Supabase RLS test proves that a Parish Office Ticket is readable by the requester and that parish's `church_admin`/`volunteer`, and not readable by unrelated parishioners or staff of other parishes.
- [ ] Migration `057` is added to `supabase/migrations/` and appended to `supabase/migrations/APPLY_ALL_MIGRATIONS.sql`.
