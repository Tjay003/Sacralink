# Project Context: SACRALINK

> **Master Architecture & Domain Documentation**: See [`Sacralink_Context.md`](./Sacralink_Context.md) for complete schema, tech stack, and module matrices.
> **Demo Mode Flags & Visibility**: See [`DEMO_MODE.md`](./DEMO_MODE.md).
> **AI Features Context**: See [`AI_Feature_Context.md`](./AI_Feature_Context.md).

---

## 1. Domain Glossary

- **Parish / Church**: An individual Roman Catholic church entity managed within the system (e.g. CSJDM parishes).
- **Parishioner**: General user who requests sacraments, books appointments, and submits cashless donations.
- **Church Admin**: Administrator assigned to manage a specific parish (schedules, sacrament requests, parish announcements).
- **Super Admin**: System-wide administrator with full privileges over all churches, user roles, and system announcements.
- **Sacrament / Service**: Religious rites and services offered by parishes (Baptism, Confirmation, Matrimony, Mass Intention, Funeral/Burial, Anointing, Blessing).
- **Appointment / Booking**: A request submitted by a parishioner for a sacrament or service on a given schedule.
- **Celebrant**: The priest who presides at an approved appointment. An appointment has at most one celebrant, and the parish office may change it after approval. _Avoid_: Officiant, assigned priest.
- **Reschedule**: Moving an approved appointment to a new date or time. It stays approved and carries a visible rescheduled notice with the reason, so the change is never mistaken for an error. _Avoid_: treating "rescheduled" as a status.
- **Appointment Change**: One recorded edit to an approved appointment (reschedule, celebrant change, cancellation or marking it celebrated), with who made it, when, and why. Together these form the appointment's change history. _Avoid_: Log, audit entry.
- **Celebrated**: An approved appointment whose rite has taken place. Its celebrant or the parish office marks it. _Avoid_: Completed, done, finished.
- **Cancelled**: An approved appointment that will no longer take place, ended by the parish office with a reason. _Avoid_: Rejected, which applies only to requests that were never approved.
- **Restore**: The parish office returning a celebrated or cancelled appointment to approved after a mistake, with a reason.
- **Donation**: A cashless transaction proof submitted with reference number and receipt image, verified by church admins.
- **Mass Schedule**: Recurring liturgical schedules and special event calendars for a parish.

---

## 2. Directory Structure

- `web/`: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 web application.
- `supabase/`: Database schema migrations (`supabase/migrations/`) and Edge Functions (`supabase/functions/`).
- `shared/`: Shared TypeScript types and constants across platforms.
- `mobile/`: React Native (Expo SDK 52+) + TypeScript + NativeWind v4 mobile application (Active).
- `docs/agents/`: Configuration and guidelines for engineering skills.
- `.agents/skills/`: Custom and Matt Pocock engineering skills suite.

---

## 3. Core Deep Domain Modules

- **Appointments Module** ([`web/src/lib/supabase/appointments.ts`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/supabase/appointments.ts)): Unified, strongly-typed domain seam for sacrament appointment queries, status state machine transitions (`pending` → `approved`/`rejected`), automatic parishioner notification dispatch, document fulfillment, and realtime channel management.
- **Donations Module** ([`web/src/lib/supabase/donations.ts`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/supabase/donations.ts)): Cashless donation proofs, receipt attachments, and verification pipeline.

