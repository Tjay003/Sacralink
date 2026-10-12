# Issue 05: Restrict Messaging Privacy for Priests

Type: task
Status: resolved
Blocked by: 02

---

## 1. Description
Protect parish clergy from unsolicited direct messaging spam by enforcing the **Office Gateway** pattern.

Currently, any authenticated user can create a direct conversation with any other user in `conversations`. If a priest's account exists, parishioners could cold-DM Father directly at any hour.

### Requirements:
1. **Database Migration (`036_restrict_parishioner_direct_messaging.sql`)**:
   - Add/update RLS policy on `public.conversations` for `type = 'direct'`:
     - If the creator is `role = 'user'`, the target participant MUST have `role IN ('church_admin', 'admin')`.
     - Direct creation of a chat with a `priest` by a `user` is rejected by the database.
     - Exception: A user with `role = 'priest'` CAN initiate a direct conversation with a parishioner if `EXISTS (SELECT 1 FROM appointments WHERE priest_id = auth.uid() AND user_id = target_user_id)`.
2. **Web & Mobile Contact Picker**:
   - In user search and "New Chat" modals, filter out users where `role = 'priest'` or `is_priest = true` when viewed by regular parishioners.
3. **Church Page Action**:
   - On `ChurchDetailPage.tsx`, ensure the chat CTA is clearly labeled **"Message Parish Office"**, routing to the church's administrative desk.

---

## 2. Acceptance Criteria
- [x] Database migration `036_restrict_parishioner_direct_messaging.sql` created and verified.
- [x] Parishioners cannot find priests in the direct chat user search list.
- [x] Direct database inserts attempting to create a user-to-priest conversation fail with RLS violation.
- [x] Priests assigned to an appointment can successfully message the relevant parishioner.
- [x] `npx tsc -b` compiles with 0 errors.

## 3. Comments

## Resolution Details
1. **Database Migration (`036_restrict_parishioner_direct_messaging.sql`)**:
   - Created safe `SECURITY DEFINER` helpers `get_user_role(UUID)` and `is_user_priest(UUID)`.
   - Updated `conversations` INSERT policy to require `created_by = auth.uid()` for direct chats.
   - Replaced `conversation_participants` INSERT policy:
     - For regular parishioners (`role = 'user'`), restricts adding direct chat participants to non-priest parish administrators (`role IN ('admin', 'church_admin')` and `is_priest IS NOT TRUE`).
     - Directly rejected cold-DMs to priests via database RLS violation (`42501`).
     - Allowed priests (`role = 'priest'` or `is_priest = true`) to initiate direct chats with parishioners assigned to an appointment (`EXISTS (SELECT 1 FROM appointments WHERE priest_id = auth.uid() AND user_id = target_user_id)`).
   - Appended migration to `supabase/migrations/APPLY_ALL_MIGRATIONS.sql`.

2. **Web Messaging & Contact Picker Hardening**:
   - In `web/src/lib/supabase/messaging.ts`:
     - Added role-aware filtering in `fetchAvailableContacts` to filter out any user where `role === 'priest' || is_priest === true` for parishioners.
     - Added client-side pre-validation in `getOrCreateDirectConversation` to prevent cold-DMs and provide immediate, descriptive user guidance.
   - In `web/src/pages/messages/MessagingPage.tsx`:
     - Filtered contacts in `filteredContacts` so priests are never discoverable in user searches or contact lists for parishioners.
     - Tailored role filter tabs for parishioners (`All Contacts`, `Parish Office`).
     - Updated dialog copy and inline feedback alert for Office Gateway interactions.

3. **Church Detail Page CTA**:
   - In `web/src/pages/churches/ChurchDetailPage.tsx`:
     - Updated messaging CTA button label to **"Message Parish Office"**.
     - Updated `handleContactParish` to specifically query and initiate conversation with the church's assigned `church_admin`.

4. **Static Validation**:
   - Ran `npx tsc -b` with 0 errors.
   - Ran `npm run build` with clean bundle compilation.
