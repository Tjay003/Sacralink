# Issue 02: Android Notification Channel & Boot Wiring

Type: task
Status: resolved
Blocked by: 01

---

## 1. Description
Ensure that Android notification channels (`appointments`, `donations`, `messages`, `announcements`) are automatically created during mobile app boot in `mobile/app/_layout.tsx` or `AuthProvider`.

---

## 2. Acceptance Criteria
- [x] `setupAndroidNotificationChannels()` is invoked gracefully on app initialization.
- [x] Safe guards in place for Expo Go and emulator environments.
- [x] `npx tsc --noEmit` passes with 0 errors.

---

## 3. Resolution
- Imported `setupAndroidNotificationChannels` from `@/lib/notifications` in `mobile/app/_layout.tsx`.
- Invoked `setupAndroidNotificationChannels()` on initial mount inside `RootLayout` via `useEffect` with error logging.
- Verified TypeScript compilation cleanly passes with `npx tsc --noEmit` (0 errors).
