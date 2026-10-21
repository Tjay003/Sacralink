# Issue 04: Priest Dashboard Layout & Spiritual Companion

Type: task
Status: resolved
Blocked by: 01, 02, 03

---

## 1. Description
Enhance `web/src/pages/dashboard/PriestDashboard.tsx` to incorporate the agreed 2-column layout, combining liturgical action with spiritual companion cards and availability controls.

### Requirements:
1. **Header Updates**:
   - Diocesan Pastoral Circular (`SystemAnnouncementsBanner`).
   - Clergy Greeting (`"Welcome, Fr. [Name]"` with liturgical date, vestment color pill, and quick `Set Availability & Leave` button).
2. **Stat Cards Row**:
   - Today's Presided Ceremonies (amber flame icon 🔥).
   - Upcoming Sacraments (blue calendar icon 📅).
   - Completed Celebrations this year (emerald check icon 🌿).
3. **Left Column (2/3 width)**:
   - **Today's Liturgical Schedule**: Prominent golden celebration cards with `Review Requirements` direct button.
   - **Celebrant Attention Queue**: Embedded `<CelebrantAttentionWidget />` (Issue 02).
   - **Presided Sacramental Schedule**: Filterable, searchable appointments table with sacrament type dropdown.
4. **Right Column (1/3 width)**:
   - **My Availability & Rota Card**: Quick view of active status, designated weekly day off, and scheduled retreat dates, with `Update Leave` modal trigger.
   - **Daily Gospel & Homily Preparation Card**: Formatted in **Newsreader serif** (`bg-amber-50/70 border border-amber-200 text-amber-950 font-serif italic`), providing today's Gospel citation and prayer prompt.
   - **Parish Bulletin Widget**: Embedded `<ChurchAnnouncementsWidget />` for local parish events.

---

## 2. Acceptance Criteria
- [x] `PriestDashboard.tsx` updated with the 2-column layout.
- [x] All components fully responsive from mobile (`375px`) to desktop (`1440px`).
- [x] Availability management modal allows Father to update his day-off and retreat dates.
- [x] Production build succeeds with `npm --prefix web run build`.

