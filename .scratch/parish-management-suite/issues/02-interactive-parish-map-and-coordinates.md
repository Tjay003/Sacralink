# 02 - Interactive Parish Map & Coordinate Storage

**What to build:**
An embedded, lightweight OpenStreetMap & Leaflet map component inside `AddChurchPage.tsx` and `EditChurchPage.tsx` with live address search, reverse geocoding, and draggable pinpoint placement, reliably saving floating-point `latitude` and `longitude` to the database.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

## Acceptance Criteria
- [ ] Interactive map rendered in `AddChurchPage.tsx` and `EditChurchPage.tsx`.
- [ ] Address search field geocodes the query and repositions the map and pin to the church address.
- [ ] Dragging the map pin updates the `latitude` and `longitude` fields in real time.
- [ ] Editing an existing church pre-loads its existing coordinates and centers the map pin.
- [ ] Form submission saves the coordinates to PostgreSQL `churches` table (`latitude`, `longitude`).
- [ ] Zero paid external API keys required; 100% functional with OpenStreetMap tiles.
