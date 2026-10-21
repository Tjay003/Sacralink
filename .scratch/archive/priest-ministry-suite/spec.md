# Specification: Priest Ministry Suite & Celebrant Hub

## 1. Executive Overview
The **Priest Ministry Suite** elevates the clergy user experience in SacraLink from a generic administrative interface into a dedicated, reverent **Clergy Celebrant Sanctuary**. 

Following Catholic Canon Law (Canon 905) and modern UX principles ("Apple meets The Vatican"), the suite provides:
1. **Pure Celebrant Experience**: Shielding clergy from administrative spreadsheets, payroll, and temporal finance management while giving them direct visibility over their presided sacraments, counseling sessions, and Mass intentions.
2. **Needs Celebrant Attention Queue**: Reusing the proven `ParishAttentionWidget` pattern to automatically surface incomplete sacrament documents (PSA birth/marriage certificates), scheduled pastoral counseling, and pre-nuptial examinations awaiting Father's review.
3. **Canonical Availability & Blackout Rota**: Allowing priests to record their weekly day off and clergy retreat dates.
4. **Smart Canon 905 & Multi-Constraint AI Solver**: Automatically validating celebrant assignments during appointment approval to prevent temporal double-booking, enforce Sunday Mass bination/trination limits, and balance celebrant workloads across parish clergy.
5. **Sacramental Search & Archive**: Enabling Father to search parish registry records and candidate documents for canonical eligibility verification.

---

## 2. Key Architectural Decisions (From Grilling Session)

### 2.1 Role Identity & Separation of Concerns (Decision Q1: Option A)
* **Dedicated Clergy Role (`role = 'priest'`)**: Routed directly to `<PriestDashboard />`. Displays liturgical milestones, today's presided ceremonies, sacramental calendar, and requirement review.
* **Dual-Role Pastors (`role = 'church_admin'` + `is_priest = true`)**: Retains the top tab switcher on `<ChurchAdminDashboard />` between *"Parish Operations"* (admin desk) and *"My Celebrant Schedule"* (embeds the Priest Dashboard).

### 2.2 Reusing Existing Components (Zero-Redundancy Principle)
To eliminate duplicate code and maintenance debt:
* **Task Manager**: Reuses `ParishAttentionWidget` architecture, parameterized for `priest_id = auth.uid()`.
* **Search Module**: Reuses `AppointmentsPage.tsx` with default filter `Celebrant = Me` and global `Ctrl+K` command search.
* **Bulletin Board**: Reuses `<SystemAnnouncementsBanner />` (Diocesan advisories), `<ChurchAnnouncementsWidget />` (Parish news), and `<LiturgicalCalendarPage />` (Gospel readings and feast days).
* **Parish Profile**: Reuses `ChurchDetailPage.tsx` in view mode.
* **Messaging**: Reuses `MessagingPage.tsx` governed by the Office Gateway pattern (Ticket 05).

### 2.3 Smart Liturgical Scheduling & Canon 905 (Decision Q2: Option A)
* **Database Model**: New `priest_availability` table recording recurring weekly days-off and dated blackout periods (e.g. diocesan retreats, sick leave).
* **AI & Heuristic Constraint Solver**:
  * **Hard Constraint 1**: Temporal overlap prevention (no double-booking).
  * **Hard Constraint 2 (Canon 905)**: Daily Mass limit enforcement (maximum 2 weekday Masses, 3 Sunday/Holy Day Masses).
  * **Hard Constraint 3**: Blackout date lockouts.
  * **Soft Constraint**: Fair celebrant load balancing across clergy members in the same parish.
  * **Natural Language Explanation**: Descriptive feedback during appointment approvals when a conflict occurs.

---

## 3. Database Schema Blueprint

```sql
CREATE TABLE IF NOT EXISTS public.priest_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    priest_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    day_of_week INT, -- 0 = Sunday, 1 = Monday, etc. (for recurring weekly day-off)
    blackout_start DATE,
    blackout_end DATE,
    reason TEXT NOT NULL DEFAULT 'Clergy Retreat / Leave',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Priests manage their own availability; parish admins and super admins can view
ALTER TABLE public.priest_availability ENABLE ROW LEVEL SECURITY;
```

---

## 4. Work Breakdown Structure
1. `01-priest-availability-and-blackout-schema.md`: PostgreSQL migration, TypeScript types, and Supabase client helpers.
2. `02-celebrant-attention-queue-widget.md`: Adapt `ParishAttentionWidget` into `CelebrantAttentionWidget.tsx` for Father's dashboard.
3. `03-smart-canon-905-conflict-solver.md`: Multi-constraint availability and daily Mass limit checker in `ApproveAppointmentModal.tsx`.
4. `04-priest-dashboard-layout-enhancement.md`: Polish `PriestDashboard.tsx` with the approved 2-column layout, availability card, and Newsreader Gospel card.
