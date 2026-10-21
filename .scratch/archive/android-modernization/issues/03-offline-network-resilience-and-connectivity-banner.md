# Issue 03: Offline Network Resilience & Connectivity Banner

Type: task
Status: resolved
Blocked by: 01

---

## 1. Description
Create a non-intrusive, beautiful Vatican Light network status component `OfflineNotice.tsx` in `mobile/src/components/common/` that appears when network connection drops and provides a quick retry mechanism.

---

## 2. Acceptance Criteria
- [x] `mobile/src/components/common/OfflineNotice.tsx` created adhering to Vatican Light design tokens.
- [x] Embedded in root layout or screen hierarchy without layout shift or overlapping.
- [x] `npx tsc --noEmit` passes with 0 errors.

---

## 3. Resolution
- Created [network.ts](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/mobile/src/lib/network.ts) with active pinging, AppState / browser listeners, and automated `@tanstack/react-query` `onlineManager` synchronization.
- Created [OfflineNotice.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/mobile/src/components/common/OfflineNotice.tsx) styled in accordance with Vatican Light design tokens (`bg-amber-50`, `border-amber-300`, sacred gold accents, smooth spring translateY / opacity transitions, reconnect celebration banner, and non-blocking touch container).
- Integrated `<OfflineNotice />` into [mobile/app/_layout.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/mobile/app/_layout.tsx) globally inside `SafeAreaProvider` and `QueryClientProvider`.
- Verified type safety via `npx tsc --noEmit` in `mobile/` with 0 errors.
