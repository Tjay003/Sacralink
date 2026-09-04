# Issue 03: Churches Directory, Interactive Map & 360° Virtual Tour

Type: task  
Status: resolved  
Blocked by: 02  

---

## 1. Description
Implement the mobile church discovery experience including the search & list view, interactive OpenStreetMap/Leaflet map with parish pins, church detail view, Mass schedule timetable, livestream embed, and 360° panorama interior tour.

---

## 2. Acceptance Criteria
- [x] Church directory screen (`app/(tabs)/explore/index.tsx`) with search bar, city filtering, and pull-to-refresh.
- [x] Interactive OpenStreetMap/Leaflet map component rendered via `react-native-webview` with parish location pins and tap-to-view modal.
- [x] Church detail screen (`app/church/[id].tsx`):
  - [x] Cover photo & church info header.
  - [x] Weekly Mass schedules list grouped by day and language.
  - [x] Contact details (phone, email, address).
  - [x] Livestream video embed (YouTube/Facebook video player or link launcher).
  - [x] 360° Virtual Interior Tour viewer rendered via `react-native-webview` from `panoramas` Supabase Storage bucket.
  - [x] Quick action buttons: "Book Sacrament", "Donate", "Chat with Parish".

---

## 3. Implementation Steps
1. Installed `react-native-webview` for native Android web rendering.
2. Created Church API and TanStack Query hooks in `mobile/src/lib/supabase/churches.ts` (`useChurches`, `useChurch(id)`).
3. Created `mobile/src/components/churches/ParishCard.tsx` with cover image, badges (360 tour, live), address, and direct link to details.
4. Created `mobile/src/components/maps/ParishMapWebView.tsx` with Leaflet/OpenStreetMap template, gold/blue church pin icons, and interactive bottom sheet quick-view.
5. Created `mobile/src/components/churches/PanoramaViewerWebView.tsx` with Pannellum 360° equirectangular virtual interior tour, touch navigation, auto-rotation, and fullscreen mode.
6. Enhanced `mobile/app/(tabs)/explore/index.tsx` with View Mode Switcher (List vs Map), search by parish name or city, regional filter chips, and pull-to-refresh (`RefreshControl`).
7. Built `mobile/app/church/[id].tsx` with hero cover, quick contact actions (call, email, facebook), weekly mass schedules grouped by day with language chips, livestream launcher, and 360° interior tour.
8. Verified with `npx tsc --noEmit` and `npx expo export --platform android` (Hermes bytecode compilation succeeded with 0 errors).

---

## 4. Resolution
- Installed and integrated `react-native-webview` 13.16.1.
- Fully wired Supabase queries with TanStack Query caching (`useChurches` and `useChurch`).
- Implemented Leaflet OpenStreetMap WebView and Pannellum 360° virtual tour WebView with zero API key dependencies.
- Passed static verification: `npx tsc --noEmit` passed with 0 errors.
- Passed Hermes Android compilation: `npx expo export --platform android` produced bundle `entry-54606fb8152602bd620720cdc06f6257.hbc` (6.7MB) cleanly.
