# Issue 08: Announcements Feed, In-App Notifications & Android Push Alerts

Type: task  
Status: ready-for-agent  
Blocked by: 02  

---

## 1. Description
Implement the Announcements feed (system-wide banners + church announcements), the in-app notification inbox, and configure `expo-notifications` for Android device push alerts.

---

## 2. Acceptance Criteria
- [ ] Announcements screen (`app/(tabs)/announcements/index.tsx`) displaying system-wide priority alerts and local parish announcements.
- [ ] In-App Notification Inbox (`app/notifications/index.tsx`) with mark-as-read and tap-to-navigate action (e.g. tapping an appointment notification navigates to the booking details).
- [ ] `expo-notifications` setup for push notification token registration with Supabase `profiles.push_token`.
- [ ] Android notification channels configured with appropriate importance and sound for appointments and message alerts.

---

## 3. Implementation Steps
1. Create `mobile/src/lib/notifications.ts` for push token registration.
2. Build `mobile/src/components/announcements/AnnouncementCard.tsx`.
3. Create `app/notifications/index.tsx` inbox screen.
