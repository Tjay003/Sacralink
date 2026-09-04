# Issue 03: Churches Directory, Interactive Map & 360° Virtual Tour

Type: task  
Status: ready-for-agent  
Blocked by: 02  

---

## 1. Description
Implement the mobile church discovery experience including the search & list view, interactive OpenStreetMap/Leaflet map with parish pins, church detail view, Mass schedule timetable, livestream embed, and 360° panorama interior tour.

---

## 2. Acceptance Criteria
- [ ] Church directory screen (`app/(tabs)/explore/index.tsx`) with search bar, city filtering, and pull-to-refresh.
- [ ] Interactive OpenStreetMap/Leaflet map component rendered via `react-native-webview` with parish location pins and tap-to-view modal.
- [ ] Church detail screen (`app/church/[id].tsx`):
  - Cover photo & church info header.
  - Weekly Mass schedules list grouped by day and language.
  - Contact details (phone, email, address).
  - Livestream video embed (YouTube/Facebook video player or link launcher).
  - 360° Virtual Interior Tour viewer rendered via `react-native-webview` from `panoramas` Supabase Storage bucket.
  - Quick action buttons: "Book Sacrament", "Donate", "Chat with Parish".

---

## 3. Implementation Steps
1. Create `mobile/src/components/churches/ParishCard.tsx`.
2. Build `mobile/src/components/maps/ParishMapWebView.tsx` with Leaflet HTML template.
3. Build `mobile/src/components/churches/PanoramaViewerWebView.tsx`.
4. Create church details route `app/church/[id].tsx`.
