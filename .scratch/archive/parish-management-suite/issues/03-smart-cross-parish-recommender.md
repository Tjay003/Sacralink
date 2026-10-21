# 03 - Smart Cross-Parish Availability & Nearby Recommender

**What to build:**
Proactive slot availability detection and an in-memory Haversine distance recommender in `BookAppointmentPage.tsx` that detects schedule collisions (e.g. booked slots, mass schedule overlap, blocked priest days) and displays dual alternative recommendation cards: (1) Next open slot at the same church, and (2) Nearest CSJDM parish offering that sacrament on the requested date with 1-click selection.

**Blocked by:** 02 - Interactive Parish Map & Coordinate Storage.

**Status:** resolved

## Acceptance Criteria
- [x] Real-time availability validator evaluates selected date, sacrament type, and church schedule.
- [x] If unavailable, renders an inline "Smart Recommendations" section without blocking or reloading.
- [x] Card A displays the earliest next available slot at the current parish.
- [x] Card B displays the nearest parish in CSJDM offering the sacrament on the requested date with distance in kilometers.
- [x] Clicking "Select This Alternative" updates the form's church, date, and time seamlessly.

## Implementation & Resolution Details
- **Haversine Distance Engine**: Implemented `calculateHaversineDistance` and `formatDistance` in `file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/geo.ts` utilizing Earth radius $R = 6371$ km.
- **Availability & Recommender Engine**: Built `evaluateSlotAndRecommendations`, `findNextAvailableSlotAtChurch`, and `findNearestAlternativeParish` in `file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/recommender.ts` to evaluate real-time slot collisions against booked appointments and blocked priest availability.
- **Smart Booking UI**: Enhanced `file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/appointments/BookAppointmentPage.tsx` with:
  - Real-time debounced availability check.
  - Inline "Smart Recommendations" alert and dual card layout: Card A (Same Parish next available slot) and Card B (Nearest alternative parish offering sacrament on requested date with distance badge in km).
  - 1-click slot selection for Card A updating date/time and clearing conflict.
  - 1-click parish transition for Card B updating church context, route, requirements, and requested slot.
- **Verification**:
  - Validated with TypeScript compiler and Vite build (`npm --prefix web run build`).
  - Created end-to-end test suite `file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/e2e/smart-recommender.spec.ts` passing all 4 test cases; verified full test suite with 47/47 passing tests.
