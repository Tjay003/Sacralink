# Issue 06: Real-Time Messaging & Video Consultation

Type: task  
Status: resolved  
Blocked by: 02  

---

## 1. Description
Implement real-time 1-on-1 text messaging between parishioners and parish staff via Supabase Realtime channels, with unread counters and a video consultation launcher for virtual pastoral counseling.

---

## 2. Acceptance Criteria
- [x] Conversations list screen (`app/messages/index.tsx`) showing active chats with avatar, last message snippet, and unread badge.
- [x] Active Chat screen (`app/messages/[conversationId].tsx`) with real-time message stream, optimistic send, auto-scroll to bottom, and timestamp formatting.
- [x] Supabase Realtime subscription (`postgres_changes` on `messages` table) for live updates.
- [x] Video Consultation Launcher: In-app browser / Jitsi Meet intent launcher for appointment video sessions.

---

## 3. Implementation Steps
1. Create `mobile/src/lib/supabase/messaging.ts`.
2. Build `mobile/src/components/chat/ChatMessageItem.tsx` and `ChatInputBar.tsx`.
3. Create routes `app/messages/index.tsx` and `app/messages/[conversationId].tsx`.

---

## 4. Resolution
- **Messaging Data Layer (`mobile/src/lib/supabase/messaging.ts`)**:
  - Implemented `fetchUserConversations(userId)` with participant joins, latest message enrichment, unread counts, and church details.
  - Implemented `fetchConversationMessages(conversationId)` ordered chronologically with sender profiles.
  - Implemented `sendMessage(conversationId, senderId, content, messageType, metadata)` with automatic `updated_at` and `last_read_at` timestamps.
  - Implemented `markConversationAsRead(conversationId, userId)`.
  - Implemented `getOrCreateParishOfficeConversation(churchId, userId)` to resolve or establish direct parish office inquiries with staff members.
  - Implemented `subscribeToConversationMessages(conversationId, onMessage)` listening to Supabase Realtime `postgres_changes`.
  - Exported TanStack Query hooks `useUserConversations` and `useConversationMessages`.
- **Chat UI Components**:
  - `mobile/src/components/chat/ChatMessageItem.tsx`: Faith Blue `#2563EB` outgoing bubbles, Slate-100 `#F1F5F9` incoming bubbles, avatars with initials fallback, formatted relative timestamps, delivery status indicators, and call invite cards.
  - `mobile/src/components/chat/ChatInputBar.tsx`: Auto-expanding multiline text input, disabled empty states, quick video consultation launcher button, and responsive Android/iOS layout.
- **Screens**:
  - `mobile/app/(tabs)/messages/index.tsx`: Active conversations stream with unread count badges, search filtering, "Start New Chat" modal with Parish Directory picker, and pull-to-refresh.
  - `mobile/app/messages/[conversationId].tsx`: Header with active status, video consultation button, real-time message stream with optimistic sending, auto-scrolling, mark as read on mount, and dual-mode Video Consultation launcher (in-app `WebView` modal and `Linking.openURL` external launcher).
  - Updated `mobile/app/_layout.tsx` to register `messages/[conversationId]` in the Stack navigator.
- **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npx expo export --platform android` generated Hermes bytecode bundle (`entry-*.hbc`, 6.9MB) successfully.
