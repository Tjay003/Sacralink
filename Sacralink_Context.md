# SACRALINK: Project Master Context & "Bible"
> **Version:** 5.0 | **Last Updated:** 2026-10-26  
> **Use this file as the single source of truth for AI coding assistants and developers. Read this file FIRST before touching any code.**

---

## 1. Project Identity

| Property | Value |
|----------|-------|
| **Title** | SACRALINK – A Cross-Platform System for Modern Parish Operations & Sacrament Management |
| **Type** | Hybrid Multi-Tenant Platform (Web Management Suite + Android Mobile App) |
| **Core Goal** | Modernize parish operations in San Jose del Monte (CSJDM) & beyond: automate sacrament scheduling with collision prevention, verify cashless donations, provide 360° virtual church access, power an AI Parishioner Assistant (Kalapati AI), and deliver a multi-tier ticket & direct messaging communication ecosystem. |
| **Target Mobile** | Android 10+ (API Level 29+) for Parishioners (React Native Expo SDK 52) |
| **Production Branch** | `feature/demo-mode` (Live Client Demos & Production Releases) |
| **Build/Test Branch** | `main` (Strictly for Integration, Building, & Automated Testing) |

---

## 2. Monorepo Structure

```text
sacralink/
├── /web          → React 19 (Vite 7) + TypeScript + Tailwind CSS v4 (Admin & Parishioner Web Suite)
├── /mobile       → React Native (Expo SDK 52) + TypeScript + NativeWind v4 (Parishioner Mobile App)
├── /supabase     → Database migrations (000-085), seeds, & Deno Edge Functions
├── /shared       → Shared TypeScript types, enums, & liturgical constants
└── /docs         → Architecture guides, ADRs, defense preparation, and triage standards
```

---

## 3. Tech Stack

### Frontend Web (`/web`)

| Category | Technology | Version / Details |
|----------|------------|-------------------|
| Framework | React | 19.x |
| Build Tool | Vite | 7.x |
| Language | TypeScript | 5.x |
| Styling | **Tailwind CSS v4** | 4.x (Utility classes only; theme tokens in `src/index.css`) |
| UI Components | Shadcn / Radix primitives | Customized accessible design system |
| Icons | Lucide React | Modern church & liturgical iconography |
| Routing | React Router DOM | 7.x (Nested routes with `DashboardLayout`) |
| State | React Context | `AuthContext`, `ToastProvider` |
| Forms & Validation | React Hook Form + Zod | Strict schema validation |
| Dates & Times | date-fns | 4.x |
| Virtual 360° Tour | Photo Sphere Viewer | WebGL equirectangular projection |
| Image Processing | browser-image-compression | Client-side compression to ~200KB before upload |

### Backend & Cloud Infrastructure (Supabase)

| Service | Purpose |
|---------|---------|
| PostgreSQL 15 | Relational core with Row-Level Security (RLS) on all tables |
| Supabase Auth | Email/Password, Google OAuth, session management |
| Supabase Storage | Buckets for avatars, 360° panoramas, donation QR codes, receipts, and sacrament documents |
| Supabase Realtime | Postgres CDC WebSocket for tickets, direct messages, and notification badges |
| Edge Functions (Deno) | Serverless AI endpoints (`church-ai-chat`, `sync-church-knowledge`) |
| Vector Engine (`pgvector`) | 768-dimensional vector storage & cosine similarity matching (`match_church_knowledge`) |
| AI Integration | Google Gemini 2.0 Flash / Flash-Lite & `gemini-embedding-001` |

---

## 4. Coding Rules & Architectural Guidelines

1. **Strict TypeScript** – No `.js` files. Interfaces and types must be defined upfront in `shared/` or `src/types/`.
2. **Supabase First** – Never guess column names. Verify schemas in `supabase/migrations/` (migrations `000` through `085`).
3. **Database Security & RLS** – Every table has RLS enabled. Use `SECURITY DEFINER` helper functions (`get_current_user_role()`, `get_current_user_church_id()`) to prevent infinite recursion on `profiles`.
4. **Tailwind v4 Clean Light Mode** – Default to clean, warm, accessible light mode ("Apple meets The Vatican"). Use design tokens (`bg-background`, `text-foreground`, `text-muted`, `border-border`, `.card`). Never hardcode dark-only slate/black containers.
5. **No Co-Author Metadata** – Never add agent co-author metadata to git commit messages.
6. **Branch Discipline**:
   - `main`: Building, staging, integration, test execution.
   - `feature/demo-mode`: Production releases and live client demos.
7. **Zero Placeholder Code** – Write complete, production-grade implementations with error boundaries and loading states.

---

## 5. Web Application Routes

All authenticated routes are nested within `DashboardLayout.tsx` with session & role protection:

| Path | Component | Access Control | Purpose |
|------|-----------|----------------|---------|
| `/login` | `LoginPage` | Public | Email/Password & Google OAuth login |
| `/register` | `RegisterPage` | Public | Account creation |
| `/forgot-password` | `ForgotPasswordPage` | Public | Password reset request |
| `/reset-password` | `ResetPasswordPage` | Public / Auth | Set new password via recovery token |
| `/privacy` | `PrivacyPage` | Public | Privacy policy & data protection terms |
| `/dashboard` | `DashboardPage` | All roles | Role-specific dashboard (Super Admin, Church Admin, Priest, User) |
| `/calendar` | `LiturgicalCalendarPage` | All roles | Interactive calendar of sacrament appointments & liturgical events |
| `/profile` | `ProfilePage` | All roles | User avatar upload, profile details, password reset, account deletion |
| `/churches` | `ChurchesPage` | All roles | Directory of CSJDM parishes with search & filters |
| `/churches/apply` | `ApplyParishPage` | All roles | Parish application submission for joining Sacralink |
| `/churches/add` | `AddChurchPage` | `super_admin` | Create new parish record |
| `/churches/:id` | `ChurchDetailPage` | All roles | Church details, mass schedule, 360° tour, announcements, AI chat |
| `/churches/:id/edit` | `EditChurchPage` | Admin+ | Modify parish info, livestream URL, service settings |
| `/churches/:id/book` | `BookAppointmentPage` | All roles | Sacrament appointment booking engine |
| `/admin/applications` | `ParishApplicationsPage` | `super_admin` | Review and approve/reject parish onboarding applications |
| `/appointments` | `AppointmentsPage` | All roles | View, filter, manage, reschedule, and celebrate sacrament bookings |
| `/messages` | `MessagingPage` | All roles | Multi-tier messaging (Tickets, Staff Channel, Direct Messages) |
| `/donations` | `DonationsPage` | All roles (view own) / Staff | Cashless donation submission and verification pipeline |
| `/admin/system-announcements` | `SystemAnnouncementsPage` | `super_admin` | Diocesan-wide announcements and top banner broadcasts |
| `/knowledge` / `/admin/knowledge-base` | `KnowledgeBasePage` | Staff / Admin | Manage parish RAG knowledge chunks and trigger vector sync |
| `/users` | `UsersPage` | `super_admin` | Manage user roles, account suspensions, and account deletion tickets |

---

## 6. The 5 Canonical User Roles

Sacralink uses a streamlined, strictly-scoped 5-role hierarchy:

| Role | Domain Title | Scope & Authority |
|------|--------------|-------------------|
| `super_admin` | Diocesan Chancellor / Platform Administrator | Global oversight across all parishes. Manages user roles, system announcements, approves new church applications, resolves escalated tickets, and executes account suspensions/deletions. **Financial Blindspot:** Super Admin cannot view or verify individual church donations or bank QR setups. |
| `church_admin` | Parish Secretary / Operations Manager | Single-parish administrator. Manages church schedules, approves/reschedules sacrament appointments, assigns celebrant priests, verifies cashless donation receipts, manages parish announcements, and maintains the AI knowledge base. |
| `priest` | Liturgical Celebrant / Pastor | Assigned to a specific parish. Views personal sacramental schedule, marks rites as celebrated, communicates via the Parish Staff Channel, and exchanges direct messages with parishioners who have an active appointment with them. |
| `volunteer` | Parish Auxiliary / Front-Desk Assistant | Assigned to a specific parish. Assists with desk triage, reviews appointments and requirement documents, verifies donation receipts, posts announcements, triages Parish Office Tickets, participates in the Staff Channel, and can direct message any volunteer or parishioner. Cannot edit church metadata, service settings, or alter user roles. |
| `user` | Parishioner / General Public | Explores parishes, takes 360° virtual tours, consults the Kalapati AI assistant, books sacrament appointments, uploads requirement documents, submits cashless donations, opens Parish Office Tickets, and sends 1-on-1 direct messages to peers and volunteers. |

---

## 7. Role-Based Dashboard Architecture

`DashboardPage.tsx` dynamically renders tailored interfaces based on the authenticated user's canonical role:

- **`SuperAdminDashboard.tsx`**: Diocesan analytics, cross-parish statistics, quick church selector, pending parish applications, and system announcement controls.
- **`ChurchAdminDashboard.tsx`**: Parish-specific operations, pending appointment queue, donation verification alerts, recent bookings widget, and AI knowledge base sync status.
- **`PriestDashboard.tsx`**: Liturgical schedule, daily Bible verse, assigned sacraments for today, and quick access to celebrant appointment lists.
- **`UserDashboard.tsx`**: Upcoming appointments, past sacrament history, home parish selector, church announcements feed, and daily Scripture inspiration.

---

## 8. Communication Subsystems & Direct Message Matrix

Sacralink segregates communication into three strictly-governed channels to preserve pastoral confidentiality and operational order:

1. **Parish Office Tickets** (`conversations` with `is_ticket = true`):
   - Categorized support inquiries (`open`, `in_progress`, `resolved`, `closed`) submitted by parishioners to a parish office.
   - Handled and triaged by Church Admins and Volunteers.
   - Supports escalation to Super Admin for diocesan-level issues.
   - Includes internal staff notes hidden from the requester.
2. **Parish Staff Channel**:
   - Internal group channel automatically provisioned per parish.
   - Membership strictly restricted to assigned `church_admin`, `priest`, and `volunteer` roles.
3. **1-on-1 Direct Messages** (`is_ticket = false`):
   - Private, confidential 1-on-1 communication strictly visible only to the two participants (no admin override).
   - Governed by the **Migration 085 Direct Message Matrix**:

### 📨 Direct Message Permission Matrix (Migration 085)

| Initiator Role \ Target Role | `super_admin` | `church_admin` | `priest` | `volunteer` | `user` (Parishioner) |
|:---|:---:|:---:|:---:|:---:|:---:|
| **`super_admin`** | ❌ *(Platform tickets)* | ✅ All Church Admins | ❌ *(Via tickets/admin)* | ❌ *(Platform tickets)* | ❌ *(Platform tickets)* |
| **`church_admin`** | ✅ Direct | ✅ Any Church Admin | ✅ Assigned Church | ✅ Assigned Church | ✅ Assigned Church |
| **`priest`** | ❌ *(Staff channel/ticket)* | ✅ Assigned Church | ❌ *(Staff channel)* | ❌ *(Staff channel)* | ✅ Shared Appointment Only |
| **`volunteer`** | ❌ *(Staff channel/ticket)* | ❌ *(Staff channel/ticket)* | ❌ *(Staff channel)* | ✅ **Any Volunteer (Any Parish)** | ✅ **Any Parishioner (Any Parish)** |
| **`user` (Parishioner)** | ❌ *(Platform ticket)* | ❌ *(Parish office ticket)* | ❌ *(Parish office ticket)* | ✅ **Any Volunteer (Any Parish)** | ✅ **Any Parishioner (Peer-to-Peer)** |

*Note: Parishioners and Volunteers attempting to cold-message Priests, Church Admins, or Super Admin are guided directly to open a Parish Office Ticket or Platform Ticket.*

---

## 9. Feature Flags & Demo Mode (`/web/src/config/featureFlags.ts`)

Sacralink includes an enterprise feature flag engine controlled by `VITE_DEMO_MODE` in `.env`:
- **Current Production Status**: All feature flags (`churches`, `appointments`, `messages`, `donations`, `calendar`, `parishionerChatbot`, `churchAiSync`, `admin`, `systemAnnouncements`, `dailyVerse`) are **fully enabled (`enabled: true`)** and run against **live database data (`useMockData: false`)**.
- In demo mode presentations (`VITE_DEMO_MODE=true`), non-destructive UI constraints are applied gracefully without disabling routes or hiding core systems.

---

## 10. Database Architecture & Active Migrations

The database is built on PostgreSQL with Supabase RLS and is currently synchronized through **Migration `085`**:

### Active Migrations (`supabase/migrations/`)
- `000`–`025`: Foundational schemas (profiles, churches, appointments, donations, storage, RLS).
- `026`–`045`: AI knowledge base vector store (`church_knowledge_chunks`), audit logs, priest availability.
- `046`–`065`: Role-based enhancements, celebrant assignments, appointment change history.
- `066`–`080`: Tickets subsystem, escalation lanes, internal notes, user suspensions, account self-deletion safeguards.
- `081`–`084`: Liturgical calendar, parish applications, priest sacrament document dossiers.
- `085`: **Direct messages enablement for Parishioners and Volunteers** (`_direct_matrix_allows`, `list_direct_contacts`).

### Core Database Tables

| Table | Purpose & Key Columns |
|-------|-----------------------|
| `profiles` | Extends `auth.users` (`id`, `full_name`, `email`, `role`, `church_id`, `avatar_url`, `phone_number`, `is_suspended`) |
| `churches` | Parish details (`id`, `name`, `address`, `latitude`, `longitude`, `livestream_url`, `operating_hours`, `contact_number`) |
| `appointments` | Sacrament bookings (`id`, `user_id`, `church_id`, `priest_id`, `sacrament_type`, `appointment_date`, `appointment_time`, `status`, `notes`) |
| `appointment_changes` | Immutable history of appointment edits (`reschedule`, `celebrant_change`, `celebrated`, `cancelled`, `restored`) |
| `appointment_documents` | Verification files uploaded by parishioners for sacrament compliance |
| `sacrament_requirements` | Canonical checklist of required documents per sacrament type |
| `church_service_types` | Parish-specific sacrament service catalog, custom durations, and offering fees |
| `priest_availability` | Availability windows, off-days, and duty schedules per priest |
| `donations` | Cashless transactions (`id`, `user_id`, `church_id`, `amount`, `reference_number`, `proof_url`, `status`) |
| `conversations` | Messaging threads (`id`, `is_ticket`, `church_id`, `ticket_lane`, `ticket_status`, `escalated_to_super_admin`) |
| `conversation_participants`| Thread membership (`conversation_id`, `user_id`, `is_handler`, `left_at`) |
| `messages` | Chat entries (`id`, `conversation_id`, `sender_id`, `content`, `is_internal_note`, `created_at`) |
| `church_knowledge_chunks` | Vector embeddings (768-dim) for RAG AI (`id`, `church_id`, `content`, `embedding`, `source_type`) |
| `church_chat_logs` | Audit trail of Kalapati AI conversations and sources used |
| `announcements` / `church_announcements` | Parish announcements with pinned banners and priority flags |
| `system_announcements` | Diocesan-wide alert banners managed by Super Admin |
| `parish_applications` | Onboarding applications submitted by visiting parishes awaiting diocesan review |
| `notifications` | In-app user notifications delivered via header notification bell |

---

## 11. Storage Buckets

| Bucket Name | Privacy | Contents |
|-------------|---------|----------|
| `avatars` | Public | Compressed user profile pictures (max 512KB, compressed to ~200KB) |
| `panoramas` | Public | 360° high-resolution church interior equirectangular panoramas (up to 10MB) |
| `donation-qr` | Public | Church GCash and Maya payment QR codes |
| `donation-proofs` | Private | Parishioner payment screenshots (accessible by church admin, volunteer, and uploader) |
| `announcements` | Public | Cover photos and banners attached to parish announcements |
| `documents` | Private | Sacrament requirements (birth certificates, baptismal records, affidavits) |

---

## 12. Design System & UI Aesthetic

Sacralink follows the **"Apple meets The Vatican"** aesthetic: modern, serene, highly accessible, and dignified.

### Color Tokens (`web/src/index.css`)
- **Primary (Faith Blue):** `#2563EB` (`var(--color-primary)` / `text-primary`, `bg-primary`, `border-primary`)
- **Secondary (Stone Gray):** `#64748B` (`var(--color-secondary)` / `text-secondary-700`, `bg-secondary-50`)
- **Accent (Sacred Gold):** `#F59E0B` (`var(--color-accent)` / `amber-500` – used for liturgical badges, candles, CTAs)
- **Success (Emerald):** `#10B981` (`var(--color-success)`)
- **Destructive (Crimson):** `#EF4444` (`var(--color-destructive)`)
- **Background:** `#F8FAFC` (`var(--color-background)`)
- **Foreground Text:** `#0F172A` (`var(--color-foreground)`)
- **Muted Text:** `#64748B` / `#94A3B8` (`var(--color-muted)`)
- **Border:** `#E2E8F0` (`var(--color-border)`)

---

## 13. Deep Architectural Features

### A. Deterministic Scheduling & Collision Prevention Engine
Sacrament appointments are booked strictly via deterministic mathematical validation—never via generative AI:
1. Validates church operating hours.
2. Checks priest duty schedule and blackout dates (`priest_availability`).
3. Computes service duration (`service_durations` or `church_service_types`).
4. Ensures zero slot overlap with existing approved bookings.
5. If collision occurs, executes the **Haversine Geodesic Recommender Engine** to suggest nearest alternative parishes.

### B. Kalapati AI: RAG Pipeline with Gemini 2.0 & pgvector
Parishioners interact with an AI assistant grounded in authoritative parish facts:
1. Parish announcements, schedules, and sacrament requirements are chunked and embedded via `gemini-embedding-001` (768 dimensions).
2. Saved into `church_knowledge_chunks` in PostgreSQL.
3. User questions trigger vector cosine similarity search via `match_church_knowledge` RPC.
4. Top matching chunks are injected into the Google Gemini 2.0 Flash prompt to generate factual, hallucination-free answers.

### C. Cashless Donation Verification Pipeline
1. Parishioners scan verified church QR codes and upload payment receipts.
2. Status enters `pending` with instant transaction logging.
3. Church Admins and Volunteers review proofs against their merchant portal.
4. Marking as `verified` or `rejected` dispatches real-time in-app notifications to the donor.

### D. User Suspension & Account Deletion Safeguards
- Parishioners can request account deletion, triggering an automatic platform ticket.
- Super Admin receives a comprehensive review summary (`get_user_review_summary`) displaying pending appointments, donations, and tickets before confirming permanent deletion.
- Immediate suspension (`suspend_user`) revokes auth access while preserving historical sacrament logs.

---

**END OF MASTER CONTEXT**
