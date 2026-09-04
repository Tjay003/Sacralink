# Issue 08: Announcements Feed, In-App Notifications & Android Push Alerts

Type: task  
Status: resolved  
Blocked by: 02  

---

## 1. Description
Implement the Announcements feed (system-wide banners + church announcements), the in-app notification inbox, and configure `expo-notifications` for Android device push alerts.

---

## 2. Acceptance Criteria
- [x] Announcements screen (`app/(tabs)/announcements/index.tsx`) displaying system-wide priority alerts and local parish announcements.
- [x] In-App Notification Inbox (`app/notifications/index.tsx`) with mark-as-read and tap-to-navigate action (e.g. tapping an appointment notification navigates to the booking details).
- [x] `expo-notifications` setup for push notification token registration with Supabase `profiles.push_token`.
- [x] Android notification channels configured with appropriate importance and sound for appointments and message alerts.

---

## 3. Implementation Steps
1. Create `mobile/src/lib/notifications.ts` for push token registration.
2. Build `mobile/src/components/announcements/AnnouncementCard.tsx`.
3. Create `app/notifications/index.tsx` inbox screen.

---

## Resolution
- Installed `expo-notifications` and `expo-device` compatible with SDK 57.
- Added `push_token` column to `public.profiles` in Supabase.
- Implemented `mobile/src/lib/notifications.ts`:
  - Configured foreground notification presentation handler via `Notifications.setNotificationHandler`.
  - Configured 4 distinct Android notification channels:
    - `appointments`: Sacrament Appointments (High priority, vibration, sound, Faith Blue `#2563EB`).
    - `donations`: Cashless Donations (High priority, sound, Emerald `#10B981`).
    - `messages`: Parish Chat Messages (Max priority, vibration, sound, Indigo `#3B82F6`).
    - `announcements`: Diocesan Bulletins (Default priority, Sacred Gold `#F59E0B`).
  - Implemented `registerForPushNotificationsAsync(userId)` gracefully handling permissions, Expo push token fetching, and persisting to `profiles.push_token` while safely skipping on emulators or web without failing.
  - Linked push registration to `AuthContext` on user login and session hydration.
- Implemented announcements data layer and UI:
  - Data helper `mobile/src/lib/supabase/announcements.ts` unifying `church_announcements` and active `system_announcements` with semantic priority mapping (urgent, holy_week, event, advisory, general), pinned ordering, and TanStack Query hook `useAnnouncements(churchId?)`.
  - Component `mobile/src/components/announcements/AnnouncementCard.tsx` featuring priority badges, church attribution, timestamp, content snippet, cover image preview, and full detail pop-up modal.
  - Screen `mobile/app/(tabs)/announcements/index.tsx` featuring urgent diocesan bulletin banner, search bar with clear action, category filter tabs (All, Diocesan, Parish Updates, Events), full modal reader, and pull-to-refresh.
- Implemented in-app notifications inbox and bell header:
  - Data helper `mobile/src/lib/supabase/notifications.ts` with `fetchUserNotifications`, `markNotificationAsRead`, `markAllNotificationsAsRead`, realtime Postgres changes subscription, and `useUserNotifications()` TanStack Query hook.
  - Reusable header component `mobile/src/components/NotificationBell.tsx` with live unread counter badge.
  - Screen `mobile/app/notifications/index.tsx` with category-colored visual icons (`Calendar`, `HeartHandshake`, `MessageSquare`, `Sparkles`, `Bell`), relative time, unread indicator dots, "Mark all read" header action, empty state, and direct navigation based on notification types and deep links.
  - Integrated `NotificationBell` in Explore (`mobile/app/(tabs)/explore/index.tsx`), Profile (`mobile/app/(tabs)/profile/index.tsx`), and Announcements (`mobile/app/(tabs)/announcements/index.tsx`).
  - Added dedicated Notifications route in `mobile/app/_layout.tsx`.
- Verified static typing with `npx tsc --noEmit` (0 errors) and Android Hermes compilation with `npx expo export --platform android` (Success).
