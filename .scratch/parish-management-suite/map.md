# Effort Map: Parish Management Suite

## Notes
- Feature branch / effort: `parish-management-suite`
- Tracker mode: Local Markdown (`.scratch/parish-management-suite/`)

## Tickets

- [x] **01**: [Admin Church Categorization & Multi-Column Sorting](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/.scratch/parish-management-suite/issues/01-admin-church-categorization-and-sorting.md) (Blocked by: none)
- [x] **02**: [Interactive Parish Map & Coordinate Storage](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/.scratch/parish-management-suite/issues/02-interactive-parish-map-and-coordinates.md) (Blocked by: none)
- [ ] **03**: [Smart Cross-Parish Availability & Nearby Recommender](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/.scratch/parish-management-suite/issues/03-smart-cross-parish-recommender.md) (Blocked by: 02)
- [ ] **04**: [Strict Manual Parish Verification & Donation Gate](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/.scratch/parish-management-suite/issues/04-strict-manual-parish-verification-and-donation-gate.md) (Blocked by: 01)
- [ ] **05**: [Real-Time Messaging & Embedded Video/Audio Conferencing](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/.scratch/parish-management-suite/issues/05-realtime-messaging-and-video-conference.md) (Blocked by: 01)

## Decisions-so-far
- Fixed donation notification duplicate dispatch and removed square checkmark emojis from title generators.
- Formulated full spec at `.scratch/parish-management-suite/spec.md`.
- Sliced into 5 vertical tracer bullet tickets.
- Implemented Ticket 01: Multi-column sorting (Role, Church, Name, Date), Church filtering dropdown, and Group by Parish Accordion Mode in UsersPage.tsx with direct REST fetching and Playwright e2e validation.
- Implemented Ticket 02: Interactive OpenStreetMap & Leaflet ChurchLocationPicker with Nominatim geocoding, draggable marker, geolocation, and coordinate persistence in Add/EditChurchPage.
