# 03 - Smart Cross-Parish Availability & Nearby Recommender

**What to build:**
Proactive slot availability detection and an in-memory Haversine distance recommender in `BookAppointmentPage.tsx` that detects schedule collisions (e.g. booked slots, mass schedule overlap, blocked priest days) and displays dual alternative recommendation cards: (1) Next open slot at the same church, and (2) Nearest CSJDM parish offering that sacrament on the requested date with 1-click selection.

**Blocked by:** 02 - Interactive Parish Map & Coordinate Storage.

**Status:** claimed

## Acceptance Criteria
- [ ] Real-time availability validator evaluates selected date, sacrament type, and church schedule.
- [ ] If unavailable, renders an inline "Smart Recommendations" section without blocking or reloading.
- [ ] Card A displays the earliest next available slot at the current parish.
- [ ] Card B displays the nearest parish in CSJDM offering the sacrament on the requested date with distance in kilometers.
- [ ] Clicking "Select This Alternative" updates the form's church, date, and time seamlessly.
