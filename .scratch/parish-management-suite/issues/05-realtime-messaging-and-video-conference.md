# 05 - Real-Time Messaging & Embedded Video/Audio Conferencing

**What to build:**
A comprehensive real-time chat interface connecting Admins, Priests, Volunteers, and Parishioners with direct 1-on-1 conversations and Parish Staff group channels powered by Supabase Realtime subscriptions. In-chat action to launch instant audio/video conference meetings embedded in a responsive modal via Jitsi Meet React SDK with microphone, camera, and screen-sharing controls.

**Blocked by:** 01 - Admin Church Categorization & Multi-Column Sorting.

**Status:** claimed

## Acceptance Criteria
- [ ] Database schema for `conversations`, `conversation_participants`, and `messages` with RLS policies.
- [ ] Responsive `MessagingPage.tsx` with conversation list, search, active chat viewport, role badges, and unread counters.
- [ ] Supabase Realtime subscription delivering instant incoming messages without page reload.
- [ ] "Start Video/Audio Meeting" button inside conversations generates a secure conference room invite.
- [ ] Embedded Jitsi Meet modal opens in-app with full audio, video, tile view, and screen-share controls.
- [ ] Zero third-party API subscription costs or custom WebRTC signaling servers required.
