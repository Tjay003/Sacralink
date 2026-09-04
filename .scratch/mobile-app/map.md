# SacraLink Mobile: Dependency Map & Task Tracker

> **Specification**: [`spec.md`](./spec.md)  
> **Target**: React Native (Expo) Android App (`mobile/`)  
> **Status**: Ready for Execution  

---

## Decisions Log
1. **Target Roles**: Full parity for all roles (`user`, `priest`, `church_admin`, `super_admin`) via dynamic role-adaptive navigation.
2. **Framework & Navigation**: React Native + Expo Router v4 + TypeScript + NativeWind v4.
3. **Hardware & Media**: `expo-image-picker` + `expo-document-picker` + `expo-image-manipulator` uploading to Supabase Storage.
4. **Maps & 360° Tours**: OpenStreetMap/Leaflet & PhotoSphere rendered via `react-native-webview` (zero Google Maps API key fees).
5. **Caching & State**: TanStack Query v5 + `@supabase/supabase-js` with `expo-secure-store`.
6. **Notifications**: In-app Notification Inbox + `expo-notifications` for Android device push alerts.

---

## Implementation Tasks

| # | Ticket | Type | Status | Blocked By |
|---|:---|:---|:---:|:---|
| **01** | [`01-scaffold-expo-mobile-foundation.md`](./issues/01-scaffold-expo-mobile-foundation.md) | `task` | `resolved` | — |
| **02** | [`02-auth-and-role-navigation.md`](./issues/02-auth-and-role-navigation.md) | `task` | `resolved` | 01 |
| **03** | [`03-churches-directory-and-interactive-map.md`](./issues/03-churches-directory-and-interactive-map.md) | `task` | `resolved` | 02 |
| **04** | [`04-sacrament-appointment-and-booking-engine.md`](./issues/04-sacrament-appointment-and-booking-engine.md) | `task` | `resolved` | 02 |
| **05** | [`05-cashless-donations-and-qr-verification.md`](./issues/05-cashless-donations-and-qr-verification.md) | `task` | `resolved` | 02 |
| **06** | [`06-realtime-messaging-and-video-consultation.md`](./issues/06-realtime-messaging-and-video-consultation.md) | `task` | `ready-for-agent` | 02 |
| **07** | [`07-parish-ai-chatbot-and-knowledge-assistant.md`](./issues/07-parish-ai-chatbot-and-knowledge-assistant.md) | `task` | `ready-for-agent` | 02 |
| **08** | [`08-announcements-notifications-and-push.md`](./issues/08-announcements-notifications-and-push.md) | `task` | `ready-for-agent` | 02 |
| **09** | [`09-admin-and-priest-mobile-workflows.md`](./issues/09-admin-and-priest-mobile-workflows.md) | `task` | `ready-for-agent` | 04, 05 |
| **10** | [`10-super-admin-mobile-system-overview.md`](./issues/10-super-admin-mobile-system-overview.md) | `task` | `ready-for-agent` | 02, 08 |
