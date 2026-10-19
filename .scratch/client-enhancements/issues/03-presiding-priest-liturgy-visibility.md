# Issue 03: Presiding Priest / Celebrant Liturgy Visibility

Type: feature
Status: proposed
Blocked by: 

---

## 1. Description
Users and parishioners attending Masses, viewing livestreams, or booking sacraments must be able to see who the presiding priest/celebrant is for any liturgical schedule.

To solve this:
1. In `ChurchDetailPage.tsx`, display the presiding priest's name and title as a clean badge on each Mass schedule card (e.g., `Celebrant: Rev. Fr. Juan dela Cruz`).
2. In `LivestreamPlayer.tsx`, display the presiding celebrant's name beneath the broadcast title when live or in the upcoming Mass countdown.
3. In `AddScheduleModal.tsx` and `EditScheduleModal.tsx`, ensure the presiding priest input or dropdown links properly to the church's assigned clergy.

### Files Involved
- [web/src/pages/churches/ChurchDetailPage.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/pages/churches/ChurchDetailPage.tsx)
- [web/src/components/livestream/LivestreamPlayer.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/livestream/LivestreamPlayer.tsx)
- [web/src/components/churches/AddScheduleModal.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/churches/AddScheduleModal.tsx)
- [web/src/components/churches/EditScheduleModal.tsx](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/components/churches/EditScheduleModal.tsx)

---

## 2. Acceptance Criteria
- [ ] Mass schedule cards on the church detail page display the presiding priest's name.
- [ ] Livestream player exhibits the presiding priest in live and standby views.
- [ ] Schedule modals allow assigning or editing the presiding priest.
- [ ] Builds and passes TypeScript validation cleanly (`tsc -b`).
