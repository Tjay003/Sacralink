# Issue 07: Hide Raw GPS Coordinates on Public Church Detail Page

Type: bug
Status: resolved
Blocked by: 

---

## 1. Description
Currently on [ChurchDetailPage.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/churches/ChurchDetailPage.tsx#L700-L704), the raw numeric latitude and longitude coordinates are displayed to regular users (e.g. `📍 Coordinates: 14.812345°, 121.054321°`). 

GPS coordinates are technical geospatial data used for backend distance calculations (Haversine formula in `recommender.ts`) and map pin placement. Displaying raw decimal coordinates clutters the UI and looks unpolished to end users and parishioners.

### Changes Required
1. In `ChurchDetailPage.tsx` (under the "Church Information" card), remove the text line rendering `📍 Coordinates: {church.latitude}°, {church.longitude}°`.
2. Keep the readable physical street address (`church.address`).
3. Keep the clean "View on Map" / "Open in OpenStreetMap/Google Maps" link so parishioners can still get directions without seeing the raw decimal numbers.

### Files Involved
- [web/src/pages/churches/ChurchDetailPage.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/churches/ChurchDetailPage.tsx)

---

## 2. Acceptance Criteria
- [x] Raw decimal GPS coordinates are hidden from public view on Church Detail pages.
- [x] Physical street address and external map directions link remain intact.
- [x] TypeScript check and build pass cleanly (`tsc -b`).

---

## 3. Resolution Details
- Removed the coordinate paragraph displaying `📍 Coordinates: {church.latitude?.toFixed(6)}°, {church.longitude?.toFixed(6)}°` in [ChurchDetailPage.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/churches/ChurchDetailPage.tsx).
- Simplified the label from "Address & Coordinates" to "Address".
- Retained the human-readable physical street address and the external OpenStreetMap direction link.
- Verified build and TypeScript typechecking via `npm run build` (`tsc -b && vite build`) with exit code 0.
