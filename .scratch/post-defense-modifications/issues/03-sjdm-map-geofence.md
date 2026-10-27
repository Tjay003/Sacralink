# 03: Geo-fence ChurchLocationPicker map and address search strictly to City of San Jose del Monte, Bulacan

Type: task
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

**What to build:** Apply a built-in Leaflet + OpenStreetMap Nominatim geo-fence to `web/src/components/churches/ChurchLocationPicker.tsx` (and the GPS helper on `EditChurchPage.tsx` / `AddChurchPage.tsx`) so the map only operates within the **City of San Jose del Monte, Bulacan (CSJDM)** with zero new external APIs:

1. **Define Official CSJDM Geographic Bounding Box**:
   - Define `SJDM_BOUNDS` covering the City of San Jose del Monte, Bulacan (`SOUTH_LAT = 14.7500`, `NORTH_LAT = 14.9000`, `WEST_LNG = 120.9800`, `EAST_LNG = 121.1600`) and a helper `isWithinSjdmBounds(lat: number, lng: number): boolean`.
2. **Leaflet Camera & Zoom Lock**:
   - Configure `L.map(...)` in `ChurchLocationPicker.tsx` with `maxBounds: L.latLngBounds([SJDM_BOUNDS.south, SJDM_BOUNDS.west], [SJDM_BOUNDS.north, SJDM_BOUNDS.east])`, `maxBoundsViscosity: 1.0`, and `minZoom: 12` so users can pan and zoom freely across all barangays of San Jose del Monte, Bulacan, but cannot drag or zoom the map out to other provinces/countries.
   - If initial coordinates passed into `ChurchLocationPicker` fall outside `SJDM_BOUNDS`, center the map on `DEFAULT_CSJDM_LAT` (`14.8135`), `DEFAULT_CSJDM_LNG` (`121.0453`).
3. **Pin Placement & Drag Boundary Check**:
   - When clicking the map, dragging the marker, or applying coordinates in `ChurchLocationPicker.tsx`, check `isWithinSjdmBounds(lat, lng)`. If outside SJDM, snap/keep the pin inside SJDM and display a clear inline warning: `"Location must be within the City of San Jose del Monte, Bulacan."`
4. **SJDM-Bounded Nominatim Address Search**:
   - In `handleSearch` inside `ChurchLocationPicker.tsx`, pass `&viewbox=${SJDM_BOUNDS.west},${SJDM_BOUNDS.north},${SJDM_BOUNDS.east},${SJDM_BOUNDS.south}&bounded=1` to the Nominatim search URL, remove the nationwide/worldwide fallback query, and filter any returned results with `isWithinSjdmBounds`.
5. **GPS Location Boundary Check**:
   - In `"Use My Current Location"` (`ChurchLocationPicker.tsx`) and `"Use current GPS"` (`EditChurchPage.tsx`), check `isWithinSjdmBounds(lat, lng)` when browser GPS returns coordinates. If the user's device is outside San Jose del Monte, Bulacan, do not move the pin outside SJDM and show a clear message (`"Your current GPS location is outside San Jose del Monte, Bulacan"`).

## Acceptance Criteria
- [ ] The Leaflet map in `ChurchLocationPicker.tsx` has `maxBounds`, `maxBoundsViscosity: 1.0`, and `minZoom: 12` locked to San Jose del Monte, Bulacan (`14.750°–14.900°N`, `120.980°–121.160°E`).
- [ ] Clicking or dragging the pin outside SJDM is rejected with a clear message keeping the pin inside SJDM.
- [ ] Searching in the map search bar uses `viewbox` + `bounded=1` and returns only locations inside San Jose del Monte, Bulacan.
- [ ] Clicking GPS when outside SJDM displays a helpful notice and keeps the map centered in SJDM.
- [ ] `tsc -b` and `vite build` pass cleanly.
