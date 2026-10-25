# Project Context: SACRALINK

> **Master Architecture & Domain Documentation**: See [`Sacralink_Context.md`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/Sacralink_Context.md) for complete schema, tech stack, and module matrices.  
> **Demo Mode Flags & Visibility**: See [`DEMO_MODE.md`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/DEMO_MODE.md).  
> **AI Features Context**: See [`AI_Feature_Context.md`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/AI_Feature_Context.md).  
> **Defense Examination Guide**: See [`docs/DEFENSE_PANEL_GUIDE.md`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/docs/DEFENSE_PANEL_GUIDE.md).

---

## 1. Domain Glossary

- **Parish / Church**: An individual Roman Catholic church entity managed within the system (e.g. CSJDM parishes).
- **Parishioner**: General user (`role = 'user'`) who requests sacraments, books appointments, submits cashless donations, asks questions to Kalapati AI, opens Parish Office Tickets, and sends 1-on-1 direct messages to peers and volunteers.
- **Volunteer**: Parish helper assigned to a church who assists with desk triage, reviews appointments, creates announcements, participates in the Parish Staff Channel, helps triage Parish Office Tickets, direct messages parishioners and fellow volunteers across parishes, and books personal sacrament appointments. Cannot alter user roles, delete parish records, or change financial QR codes.
- **Church Admin**: Administrator assigned to manage a specific parish (schedules, sacrament requests, parish announcements, cashless donation verification, and knowledge base sync).
- **Super Admin**: System-wide diocesan administrator with full privileges over all churches, user roles, system announcements, and escalated tickets. Maintained with a strict financial blindspot (no direct access to church bank donations).
- **Priest**: Liturgical celebrant assigned to a parish. Views personal sacrament bookings, marks rites as celebrated, communicates via the Parish Staff Channel, and exchanges direct messages with parishioners who share an active appointment.
- **Direct Message**: A private 1-on-1 conversation strictly visible only to its two participants (no admin override).
- **Parish Office Ticket**: A categorized support inquiry (`open`, `in_progress`, `resolved`, `closed`) submitted by a parishioner to a parish's office desk and triaged by assigned parish staff.
- **Staff Channel**: An internal conversation room for a parish's assigned clergy, church admins, and volunteers.
- **Sacrament / Service**: Religious rites and services offered by parishes (Baptism, Confirmation, Matrimony, Mass Intention, Funeral/Burial, Anointing, Blessing).
- **Appointment / Booking**: A request submitted by a parishioner for a sacrament or service on a given schedule.
- **Celebrant**: The priest who presides at an approved appointment. An appointment has at most one celebrant, and the parish office may change it after approval.
- **Reschedule**: Moving an approved appointment to a new date or time. It stays approved and carries a visible rescheduled notice with the reason, so the change is never mistaken for an error.
- **Appointment Change**: One recorded edit to an approved appointment (reschedule, celebrant change, cancellation or marking it celebrated), with who made it, when, and why. Together these form the appointment's immutable change history.
- **Celebrated**: An approved appointment whose rite has taken place. Marked by its assigned celebrant or the parish office.
- **Cancelled**: An approved appointment that will no longer take place, ended by the parish office with a documented reason.
- **Restore**: The parish office returning a celebrated or cancelled appointment to approved status after an error, with a documented reason.
- **Donation**: A cashless transaction proof submitted with reference number and receipt image, verified by church admins and volunteers.
- **Mass Schedule**: Recurring liturgical schedules and special event calendars for a parish.

---

## 2. Direct Message Permission Matrix (Migration 085)

| Initiator Role \ Target Role | `super_admin` | `church_admin` | `priest` | `volunteer` | `user` (Parishioner) |
|:---|:---:|:---:|:---:|:---:|:---:|
| **`super_admin`** | ❌ *(Platform tickets)* | ✅ All Church Admins | ❌ *(Via tickets/admin)* | ❌ *(Platform tickets)* | ❌ *(Platform tickets)* |
| **`church_admin`** | ✅ Direct | ✅ Any Church Admin | ✅ Assigned Church | ✅ Assigned Church | ✅ Assigned Church |
| **`priest`** | ❌ *(Staff channel/ticket)* | ✅ Assigned Church | ❌ *(Staff channel)* | ❌ *(Staff channel)* | ✅ Shared Appointment Only |
| **`volunteer`** | ❌ *(Staff channel/ticket)* | ❌ *(Staff channel/ticket)* | ❌ *(Staff channel)* | ✅ **Any Volunteer (Any Parish)** | ✅ **Any Parishioner (Any Parish)** |
| **`user` (Parishioner)** | ❌ *(Platform ticket)* | ❌ *(Parish office ticket)* | ❌ *(Parish office ticket)* | ✅ **Any Volunteer (Any Parish)** | ✅ **Any Parishioner (Peer-to-Peer)** |

---

## 3. Directory Structure

- `web/`: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 web application.
- `supabase/`: Database schema migrations (`supabase/migrations/` 000–085) and Edge Functions (`supabase/functions/`).
- `shared/`: Shared TypeScript types, enums, and liturgical constants across platforms.
- `mobile/`: React Native (Expo SDK 52) + TypeScript + NativeWind v4 mobile application.
- `docs/agents/`: Configuration and guidelines for engineering skills and local testing.
- `.agents/skills/`: Custom engineering skills suite.

---

## 4. Core Deep Domain Modules

- **Appointments Module** ([`web/src/lib/supabase/appointments.ts`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/supabase/appointments.ts)): Unified, strongly-typed domain seam for sacrament appointment queries, status transitions (`pending` → `approved`/`rejected`), automatic notification dispatch, celebrant assignment, rescheduling, celebration, document fulfillment, and realtime channel management.
- **Donations Module** ([`web/src/lib/supabase/donations.ts`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/supabase/donations.ts)): Cashless donation proofs, receipt attachments, and verification pipeline.
- **Messaging & Tickets Module** ([`web/src/lib/supabase/messages.ts`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/supabase/messages.ts)): Multi-tier communication supporting private 1-on-1 direct messages (under Migration 085 matrix), internal parish staff channels, and parish office support tickets with lifecycle management (`open`, `in_progress`, `resolved`, `closed`), staff assignment, escalation to Super Admin, and internal notes.
- **Knowledge Base & RAG AI Module** ([`web/src/lib/supabase/knowledge.ts`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/supabase/knowledge.ts)): Parish knowledge chunk management, automated vector embedding generation (`gemini-embedding-001`), and cosine similarity search for the Kalapati AI assistant.
- **User Management & Deletion Lifecycle Module** ([`web/src/lib/supabase/profiles.ts`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/supabase/profiles.ts)): User profile maintenance, avatar upload with client-side compression, role assignments, user suspensions, and ticket-based account deletion safeguards.
