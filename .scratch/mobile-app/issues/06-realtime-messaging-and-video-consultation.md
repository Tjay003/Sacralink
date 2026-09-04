# Issue 06: Real-Time Messaging & Video Consultation

Type: task  
Status: ready-for-agent  
Blocked by: 02  

---

## 1. Description
Implement real-time 1-on-1 text messaging between parishioners and parish staff via Supabase Realtime channels, with unread counters and a video consultation launcher for virtual pastoral counseling.

---

## 2. Acceptance Criteria
- [ ] Conversations list screen (`app/messages/index.tsx`) showing active chats with avatar, last message snippet, and unread badge.
- [ ] Active Chat screen (`app/messages/[conversationId].tsx`) with real-time message stream, optimistic send, auto-scroll to bottom, and timestamp formatting.
- [ ] Supabase Realtime subscription (`postgres_changes` on `messages` table) for live updates.
- [ ] Video Consultation Launcher: In-app browser / Jitsi Meet intent launcher for appointment video sessions.

---

## 3. Implementation Steps
1. Create `mobile/src/lib/supabase/messaging.ts`.
2. Build `mobile/src/components/chat/ChatMessageItem.tsx` and `ChatInputBar.tsx`.
3. Create routes `app/messages/index.tsx` and `app/messages/[conversationId].tsx`.
