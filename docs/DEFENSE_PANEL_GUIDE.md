# SACRALINK: Comprehensive Defense Examination & Technical Architecture Guide
> **Document Purpose:** Oral Defense Preparation, Technical Architecture Manual, and Role-Based Operational Guide  
> **Target Audience:** Thesis/Capstone Defense Panelists, System Evaluators, and Client Administrators  
> **System Name:** SACRALINK – A Cross-Platform System for Modern Parish Operations and Sacrament Management  
> **Coverage:** All 5 User Roles, Database Security & RLS, Recommender Algorithms, RAG AI Pipeline, and Technical Q&A

---

## Table of Contents
1. [Executive System Overview](#1-executive-system-overview)
2. [Core Architecture & Non-Negotiable Defense Foundations](#2-core-architecture--non-negotiable-defense-foundations)
   - [2.1 High-Level Architecture & Tech Stack Justification](#21-high-level-architecture--tech-stack-justification)
   - [2.2 Multi-Tenancy & Database Security (Row-Level Security)](#22-multi-tenancy--database-security-row-level-security)
   - [2.3 The "Super Admin Financial Blindspot" Policy](#23-the-super-admin-financial-blindspot-policy)
3. [Role-by-Role Operations, Workflows & Defense Guides](#3-role-by-role-operations-workflows--defense-guides)
   - [3.1 Role 1: Super Admin (Diocesan Chancellor / Platform Administrator)](#31-role-1-super-admin-diocesan-chancellor--platform-administrator)
   - [3.2 Role 2: Church Admin (Parish Secretary / Operations Manager)](#32-role-2-church-admin-parish-secretary--operations-manager)
   - [3.3 Role 3: Volunteer (Parish Auxiliary / Front-Desk Staff)](#33-role-3-volunteer-parish-auxiliary--front-desk-staff)
   - [3.4 Role 4: Priest (Liturgical Celebrant / Pastor)](#34-role-4-priest-liturgical-celebrant--pastor)
   - [3.5 Role 5: User (Parishioner / General Public)](#35-role-5-user-parishioner--general-public)
4. [Deep Dives on Complex Components & Panelist Battlegrounds](#4-deep-dives-on-complex-components--panelist-battlegrounds)
   - [4.1 Deterministic Appointment Scheduling & Collision Prevention Engine](#41-deterministic-appointment-scheduling--collision-prevention-engine)
   - [4.2 Cross-Parish Recommender Engine: Haversine Geodesic Distance Formula](#42-cross-parish-recommender-engine-haversine-geodesic-distance-formula)
   - [4.3 AI Parishioner Assistant: RAG Pipeline with Supabase pgvector & Google Gemini](#43-ai-parishioner-assistant-rag-pipeline-with-supabase-pgvector--google-gemini)
   - [4.4 Cashless Donation & Payment Verification Workflow](#44-cashless-donation--payment-verification-workflow)
   - [4.5 Document Dossier & Client-Side Image Compression](#45-document-dossier--client-side-image-compression)
   - [4.6 360° Virtual Church Tour: Equirectangular Projections & WebGL](#46-360-virtual-church-tour-equirectangular-projections--webgl)
   - [4.7 Real-Time Synchronization & Cross-User Notifications](#47-real-time-synchronization--cross-user-notifications)
   - [4.8 Multi-Tier Communication Architecture: Parish Office Tickets & Direct Messaging Matrix](#48-multi-tier-communication-architecture-parish-office-tickets--direct-messaging-matrix)
5. [Top 15 Panelist "Trap Questions" & Winning Defense Answers](#5-top-15-panelist-trap-questions--winning-defense-answers)

---

# 1. Executive System Overview

### The Problem
In the City of San Jose del Monte (CSJDM), Bulacan, Catholic parishes handle tens of thousands of parishioners across multiple sacramental services (Baptism, Confirmation, Matrimony, Funerals, Anointing of the Sick, Mass Intentions). Traditional operations suffer from:
1. **Physical Queues & Manual Ledgers:** Parishioners travel long distances and wait hours just to inquire about schedules or submit physical document requirements.
2. **Scheduling Collisions & Priest Fatigue:** Double-booked sacrament appointments occur due to disjointed paper diaries and lack of centralized priest availability tracking.
3. **Delayed Verification of Digital Donations:** Parishes receiving GCash/Maya transfers lack an audit-ready reconciliation workflow.
4. **Information Asymmetry:** Parishioners often do not know document requirements, parish boundaries, or alternative schedules when their home parish is fully booked.

### The Solution: SACRALINK
SACRALINK is a centralized, multi-tenant digital parish operations ecosystem designed for diocesan oversight and local parish autonomy. It features:
- **Autonomous Multi-Tenancy:** Each parish operates its own scheduling, announcements, and finances while the diocese maintains oversight.
- **Deterministic Scheduling Engine:** Prevents collisions mathematically without relying on unpredictable AI agents.
- **Haversine Geo-Spatial Recommender:** Automatically recommends the nearest alternative parish if a requested date or time is unavailable.
- **RAG-Powered AI Parishioner Assistant:** Uses Google Gemini 2.0 and Supabase `pgvector` to answer parish-specific inquiries accurately using official church data.
- **360° Immersive Virtual Tours:** WebGL-rendered equirectangular tours enabling elderly, disabled, or overseas parishioners to explore sacred spaces virtually.

---

# 2. Core Architecture & Non-Negotiable Defense Foundations

## 2.1 High-Level Architecture & Tech Stack Justification

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                              │
│   React 19 (Vite 7) + TypeScript + Tailwind CSS v4 + Lucide React     │
│   - Role-Based Dynamic Dashboards (Super Admin, Admin, Priest, User)   │
│   - Photo Sphere Viewer (WebGL Equirectangular 360° Panoramas)         │
│   - Client-Side Image Compression (browser-image-compression)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / WSS
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    SUPABASE CLOUD INFRASTRUCTURE                       │
│                                                                        │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │     Supabase Auth     │  │ Supabase Storage│  │ Supabase Realtime│  │
│  │ (OAuth, Sessions, JWT)│  │(Private/Public) │  │(Postgres CDC WSS)│  │
│  └───────────────────────┘  └─────────────────┘  └──────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                 PostgreSQL 15 (Relational Core)                  │  │
│  │  - Row-Level Security (RLS) on all tables                        │  │
│  │  - SECURITY DEFINER helper functions (anti-recursion)            │  │
│  │  - pgvector extension (768-dimensional embeddings)               │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │ Invocation
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    SERVERLESS EDGE RUNTIME (DENO)                      │
│                                                                        │
│  1. `sync-church-knowledge`: Extracts announcements/mass schedules,     │
│     generates vectors via Google `gemini-embedding-001`, saves to DB   │
│  2. `church-ai-chat`: Queries `match_church_knowledge` RPC, feeds      │
│     retrieved chunks to Google Gemini 2.0 Flash Lite / Flash           │
└────────────────────────────────────────────────────────────────────────┘
```

### Why This Stack? (Panel Defense Argument)
* **Why React 19 + TypeScript over raw HTML/PHP?** Type safety eliminates runtime type exceptions across complex sacramental data models. React’s component model allows modular dashboards per role.
* **Why Supabase over building an Express/Node backend from scratch?** Supabase provides enterprise-grade PostgreSQL with battle-tested Row-Level Security (RLS), real-time WebSocket change detection, and native vector storage (`pgvector`) without maintenance overhead.
* **Why Google Gemini 2.0 Flash over OpenAI GPT-4?** Faster inference speeds, larger context windows, lower operational costs, and native 768-dimensional embedding models (`gemini-embedding-001`) that integrate directly with PostgreSQL vector indexes.

---

## 2.2 Multi-Tenancy & Database Security (Row-Level Security)

### Intuition (Real-World Analogy)
> **The Apartment Complex Metaphor:**  
> Think of a multi-tenant database like a large apartment building. All tenants share the same foundation, plumbing, and roof (the shared database and schema), but every tenant has their own physical key. A resident in Unit 301 cannot open the door or look inside Unit 405. In Sacralink, PostgreSQL's Row-Level Security (RLS) acts as that unbreakable electronic lock on every single row of data.

### Engineering Deep Dive
Rather than spinning up separate databases for each parish (which is expensive and difficult to maintain), Sacralink implements **Shared Database, Shared Schema Multi-Tenancy** governed by **PostgreSQL Row-Level Security (RLS)**.

Every church-specific record contains a foreign key: `church_id UUID REFERENCES churches(id)`.

#### The RLS Policy Trap & Solution (`SECURITY DEFINER`)
In PostgreSQL, if a policy on the `profiles` table inspects the `profiles` table to see what role the user has, the query triggers the policy again, resulting in **infinite recursion** and a `500 Internal Server Error`.

Sacralink resolves this using `SECURITY DEFINER` helper functions that execute with administrative privileges and bypass the RLS check for role evaluation:
```sql
-- Prevents RLS infinite recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_church_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assigned_church_id FROM public.profiles WHERE id = auth.uid();
$$;
```

---

## 2.3 The "Super Admin Financial Blindspot" Policy

> [!IMPORTANT]
> **High-Probability Panelist Question:**  
> *"If the Super Admin is the system owner, why are they blocked from viewing parish donations and money balances?"*

### Non-Technical Explanation (Intuition)
In the Catholic Church, every parish is an autonomous canonical entity under the care of its Parish Priest (Canon 532). A diocesan administrator or IT super administrator does not have unilateral access to local parish ledgers. Giving a platform administrator access to parish donation revenues violates canonical boundaries and invites financial mistrust.

### Technical & Legal Justification
1. **Canon Law Compliance (Can. 1281–1288):** Parish temporal goods belong to the juridic person of the parish, administered solely by the parish priest.
2. **Philippine Data Privacy Act of 2012 (RA 10173):** Financial transactions between a parishioner and their parish are private transactional data. Centralizing financial logs under global admins without parish consent violates the principle of proportionality.
3. **Technical Enforcement:**  
   - In `DashboardLayout.tsx`, the `/donations` navigation link is strictly removed when `profile.role === 'super_admin'`.
   - In `DonationsPage.tsx`, routing logic renders an immediate `Access Restricted` state if a Super Admin attempts to force navigation to the page.
   - Database RLS policies on the `donations` table restrict `SELECT` queries strictly to the parishioner who donated and staff assigned to that specific `church_id`.

---

# 3. Role-by-Role Operations, Workflows & Defense Guides

---

## 3.1 Role 1: Super Admin (Diocesan Chancellor / Platform Administrator)

`<<INSERT IMAGE OF: Super Admin Diocese Overview Dashboard showing Total Users, Total Churches, Pending Applications, and Diocese Announcements>>`

### Intuition (Non-Technical Explanation)
The Super Admin is like the **Diocesan Chancellor or City Archbishop’s Executive Secretary**. They do not run the daily front desk of a parish. Instead, they oversee the entire territory: certifying new parishes, moderating diocesan-wide announcements, and onboarding parish rectors and secretaries.

### Key Capabilities & Responsibilities
1. **Diocese-Wide Operational Visibility:** Views all accredited churches in CSJDM, total system parishioners, and aggregate appointment throughput.
2. **Parish Accreditation & Application Review:** Inspects applications from new parishes wishing to join Sacralink (`/admin/applications`) and approves or denies accreditation.
3. **Parish Switching / Impersonation Inspection:** Uses the church selector dropdown to inspect how any local parish’s dashboard looks without altering financial ledgers.
4. **Platform-Wide Announcements:** Dispatches high-priority banners (`/admin/system-announcements`) that render across all parish dashboards (e.g., typhoon advisories, diocesan synods, liturgical directives).
5. **Global User Directory & Role Promotion:** Audits user roles, assigns staff to specific parishes, and initiates the security-guarded platform ownership transfer workflow.

`<<INSERT IMAGE OF: Super Admin Parish Applications Management Page with Approval/Rejection Action Modals>>`

### Panelist Defense Q&A for Super Admin
* **Q: Can a Super Admin edit an appointment booked at a specific church?**  
  *A:* No. Appointments are managed by the parish priest and the church admin of that specific church. The Super Admin has diocesan governance authority, not parish operational authority.
* **Q: How does the system prevent a rogue Super Admin from deleting the entire database?**  
  *A:* Supabase Point-in-Time Recovery (PITR) is enabled. Destructive operations (like changing another Super Admin's role or transferring ownership) require explicit modal confirmation and are restricted by database constraints.

---

## 3.2 Role 2: Church Admin (Parish Secretary / Operations Manager)

`<<INSERT IMAGE OF: Church Admin Dashboard showing Parish Operations Tab, Mass Schedule, AI Knowledge Sync Button, and Recent Appointments>>`

### Intuition (Non-Technical Explanation)
The Church Admin is the **Parish Secretary or Office Administrator**. They are the operational heart of the church office. They configure the parish's schedule, review incoming sacrament requests, check documents, assign the celebrating priest, manage announcements, and verify GCash donations.

### Key Capabilities & Responsibilities
1. **Parish Profile & Liturgical Timetable:** Edits parish operating hours, regular Sunday and weekday Mass schedules, and live broadcast links (YouTube/Facebook Live).
2. **Appointment Triage & Priest Assignment:**  
   - Inspects incoming sacrament bookings.
   - Reviews uploaded documents (birth certificates, baptismal records, marriage licenses).
   - Assigns an available parish priest to the celebration.
   - Provides official admin feedback or pastoral instructions to the parishioner.
3. **Cashless Donation Verification:** Reviews submitted GCash/Maya reference numbers and payment proof screenshots, marking them as `verified` or `rejected`.
4. **Parish AI Knowledge Base Synchronization:** Triggers the `sync-church-knowledge` Edge Function, indexing recent parish announcements and sacrament guidelines into the vector database.
5. **Parish Announcements:** Creates, updates, and removes parish-specific event notices and liturgical advisories.

`<<INSERT IMAGE OF: Church Admin Appointment Review Modal with Priest Selector, Admin Feedback Input, and Status Action Buttons>>`

### Panelist Defense Q&A for Church Admin
* **Q: What happens if a Church Admin approves an appointment without selecting a priest?**  
  *A:* The system allows approval with or without immediate priest assignment, depending on whether the parish assigns celebrants dynamically closer to the date. However, if assigned, the system verifies that the priest does not have a schedule block on that date.
* **Q: Can Church Admin A view the appointments or finances of Church Admin B?**  
  *A:* No. The `appointments` and `donations` queries strictly enforce `.eq('church_id', profile.assigned_church_id)`. Attempting to query another parish's data is rejected at both the API layer and the PostgreSQL RLS layer.

---

## 3.3 Role 3: Volunteer (Parish Auxiliary / Front-Desk Staff)

`<<INSERT IMAGE OF: Volunteer View of the Dashboard showing Parish Operations and Announcement Creation>>`

### Intuition (Non-Technical Explanation)
The Volunteer is like a **Parish Youth Ministry Volunteer or Front-Desk Assistant**. During busy fiesta seasons, advent novenas, or holiday queues, volunteers assist the parish secretary by reviewing appointments, verifying documents, and updating the parish community bulletin board.

### Key Capabilities & Role Boundaries (RBAC Matrix)

| Feature / Action | Church Admin | Volunteer | Security Rationale |
|:---|:---:|:---:|:---|
| View Parish Appointments | ✅ Yes | ✅ Yes | Volunteers assist with desk intake |
| Approve / Reject Appointments | ✅ Yes | ✅ Yes | Front-desk triage support |
| Review Uploaded Documents | ✅ Yes | ✅ Yes | Intake inspection |
| Create Parish Announcements | ✅ Yes | ✅ Yes | Community communication |
| Verify Donation Receipts | ✅ Yes | ✅ Yes | Financial intake verification |
| Direct Message Parishioners & Volunteers | ✅ Assigned Parish | ✅ Any Parishioner & Volunteer | Enables parish assistance and community outreach (Migration 085) |
| Triage Parish Office Tickets | ✅ Yes | ✅ Yes | Front-desk ticket triage and support |
| View / Edit User Roles (`/users`) | ✅ Yes | ❌ **Blocked** | Volunteers cannot alter user access |
| Access Parish Applications | ❌ No | ❌ **Blocked** | Restricted to Super Admin |
| Modify Church Canonical Settings | ✅ Yes | ❌ **Blocked** | Volunteers cannot alter parish metadata |

### Panelist Defense Q&A for Volunteer
* **Q: Why not just make volunteers regular Church Admins?**  
  *A:* The **Principle of Least Privilege (PoLP)**. Volunteers should assist with operational workload without having the authority to alter staff roles, delete parish records, or reconfigure core institutional settings.

---

## 3.4 Role 4: Priest (Liturgical Celebrant / Pastor)

`<<INSERT IMAGE OF: Priest Liturgical Celebrant Dashboard showing Daily Scripture Verse, Celebrant Greeting, and Assigned Appointments for Today>>`

### Intuition (Non-Technical Explanation)
The Priest role is built specifically for **The Celebrant Father**. Priests do not need to deal with administrative clutter or system settings. When Father logs into Sacralink, he sees his solemn **Liturgical Dossier**: which sacraments he is celebrating today, who the families are, their contact numbers, and their submitted documentation.

### Key Capabilities & Responsibilities
1. **Solemn Liturgical Celebrant Ministry Header:** Displays the daily liturgical quote, today’s date, and a pastoral greeting tailored to clergy.
2. **Personalized Celebration Queue:** Displays sacraments where `appointments.priest_id = profile.id` categorized into:
   - *Today's Celebrations* (Immediate pastoral focus)
   - *Upcoming Celebrations* (Future calendar planning)
   - *Completed Celebrations* (Historical pastoral log)
3. **Parishioner Dossier & Document Inspection:** Opens a dedicated modal to inspect uploaded sacramental documents (e.g., checking marriage counseling certificates or baptismal sponsorships before stepping into the sanctuary).
4. **Pastoral Contact Details:** Quick access to the parishioner’s phone number and email for pastoral preparation or emergency contact.
5. **Priest Availability Block-Outs:** Records retreats, diocesan meetings, or sick leaves in `priest_availability` to automatically prevent parishioners from scheduling appointments during those times.

`<<INSERT IMAGE OF: Priest Document Inspection Modal displaying submitted Baptism/Wedding Requirements>>`

### Panelist Defense Q&A for Priest
* **Q: Can a priest view appointments assigned to other priests?**  
  *A:* In the Priest Dashboard, the query filters strictly by `priest_id = current_user_id`. Priests see only their assigned pastoral responsibilities to prevent schedule confusion.

---

## 3.5 Role 5: User (Parishioner / General Public)

`<<INSERT IMAGE OF: User Dashboard showing Daily Verse, Quick Action Cards, and Upcoming Approved Appointments>>`

### Intuition (Non-Technical Explanation)
The User is the **Parishioner or Catholic Citizen**. Through Sacralink, they experience the parish office from their phone or computer: discovering churches, taking 360° virtual tours, booking sacramental appointments without queues, uploading documents safely, and chatting with an AI assistant for instant answers.

### Key Capabilities & Parishioner Journey
1. **Parish Discovery & 360° Virtual Tour:** Explores church interiors, reviews Mass schedules, and accesses live online broadcasts.
2. **Self-Service Sacrament Booking:** Selects a sacrament, desired date, and preferred time slot.
3. **Automated Conflict Resolution:** If a slot is taken, the system instantly suggests:
   - The *next available slot at the same church*, and
   - The *closest neighboring parish with an open slot on that date* (via Haversine algorithm).
4. **Document Dossier Upload:** Uploads required documents with client-side image compression, reducing upload bandwidth while protecting document clarity.
5. **Cashless Donations:** Scans parish-specific GCash or Maya QR codes and uploads the transaction receipt for office reconciliation.
6. **Real-Time Notification Bell:** Receives instant notifications when their appointment is approved, rescheduled, or requires additional documentation.
7. **24/7 AI Parishioner Assistant:** Queries the parish chatbot to get answers regarding dress codes, godfather requirements, or office operating hours.

`<<INSERT IMAGE OF: User Booking Screen with Date/Time Picker and Document Upload Zone>>`

---

# 4. Deep Dives on Complex Components & Panelist Battlegrounds

---

## 4.1 Deterministic Appointment Scheduling & Collision Prevention Engine

> [!CAUTION]
> **Primary Defense Trap Question:**  
> *"Did you use Artificial Intelligence / LLMs to schedule your appointments?"*  
> **Winning Answer:** **NO.** We strictly use a **Deterministic Constraint Satisfaction Algorithm**. Using an LLM for scheduling introduces non-deterministic hallucinations, race conditions, and double-booking errors.

### Intuition (Analogy)
Think of appointment booking like reserved seating at a cinema. You would never ask a chat bot: *"Can you please try to reserve seat F12 for me?"* because two people asking simultaneously might both be told "Yes!". Instead, you use a deterministic transactional database ledger that checks whether the seat is taken, locks it, and verifies availability before confirming.

### Under the Hood: The 4-Step Validation Pipeline

```
Parishioner Submits (Church, Sacrament, Date, Time)
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Normalization & Temporal Formatting                 │
│ - Normalizes all strings ("02:00 PM", "14:00:00") to "14:00"│
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Active Appointment Collision Check                  │
│ Query: `appointments` WHERE church_id = X AND date = Y      │
│ Status NOT IN ('rejected', 'cancelled')                     │
│ ➔ IF conflict exists ➔ REJECT & TRIGGER RECOMMENDER         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Priest Availability & Block-out Verification        │
│ Query: `priest_availability` WHERE church_id = X            │
│ AND available_date = Y AND is_blocked = TRUE                │
│ ➔ IF blocked covering time ➔ REJECT & TRIGGER RECOMMENDER   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Atomic Insertion & Document Attachment              │
│ Executes `createAppointmentWithDocuments()` within Supabase │
│ Transaction ➔ Dispatches In-App Notification                │
└─────────────────────────────────────────────────────────────┘
```

`<<INSERT IMAGE OF: Appointment Conflict Modal showing "Time Slot Taken" and alternative recommendations>>`

---

## 4.2 Cross-Parish Recommender Engine: Haversine Geodesic Distance Formula

When a parishioner requests a slot that is already booked, Sacralink does not simply display an error message. It executes the **Haversine Geodesic Recommender Engine** implemented in [`src/lib/recommender.ts`](file:///C:/Users/Tyrone%20James%20Bacolod/OneDrive/Desktop/All%20Apps/Bacolod%20FIles/PROJECTS/DARWIN/Sacralink/web/src/lib/recommender.ts).

### Intuition (Analogy)
If your favorite clinic is fully booked today, an intelligent assistant does two things:
1. It checks if the same clinic has an opening later that afternoon or next week.
2. It checks the next closest accredited clinic down the road that has an opening today.

### The Mathematics Behind Haversine
The Earth is an oblate spheroid, not a flat plane. Calculating distance using simple Pythagorean geometry ($d = \sqrt{\Delta x^2 + \Delta y^2}$) causes large mathematical distortions. The **Haversine Formula** calculates the great-circle distance between two pairs of latitude and longitude coordinates over the Earth's surface:

$$\Delta\text{lat} = \text{lat}_2 - \text{lat}_1$$

$$\Delta\text{lon} = \text{lon}_2 - \text{lon}_1$$

$$a = \sin^2\left(\frac{\Delta\text{lat}}{2}\right) + \cos(\text{lat}_1) \cdot \cos(\text{lat}_2) \cdot \sin^2\left(\frac{\Delta\text{lon}}{2}\right)$$

$$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right)$$

$$d = R \cdot c$$

*(Where $R = 6,371\text{ km}$, the mean radius of the Earth).*

### Implementation in Code (`src/lib/geo.ts` & `recommender.ts`)
```typescript
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}
```

### Recommendation Algorithm Flow
1. **Same-Church Fallback:** Evaluates the next open standard slot (`STANDARD_TIME_SLOTS`) on the same date. If full, it checks sequential days up to **14 days ahead**.
2. **Cross-Parish Fallback:**
   - Filters all active, verified parishes in the diocese.
   - Calculates Haversine distance from the user’s selected parish coordinates (default center: CSJDM $14.8135^\circ\text{N}, 121.0453^\circ\text{E}$).
   - Sorts parishes by ascending physical distance (`distanceKm`).
   - Checks the nearest parish for open slots on the requested date.
   - Returns a structured recommendation card showing distance (e.g., *"3.2 km away at St. Joseph the Worker Parish"*).

`<<INSERT IMAGE OF: Haversine Cross-Parish Recommendation Card showing Church Name, Distance in km, and Quick-Book Button>>`

---

## 4.3 AI Parishioner Assistant: RAG Pipeline with Supabase pgvector & Google Gemini

`<<INSERT IMAGE OF: Parishioner Chatbot Floating Widget on Church Detail Page showing inquiry and AI answer with source citations>>`

### Intuition (Analogy)
> **The "Open-Book Exam" Metaphor:**  
> Asking a regular AI a question about a specific church is like asking a student to guess the rules of a local community from memory—they might invent plausible-sounding details (hallucination).  
> **Retrieval-Augmented Generation (RAG)** is like handing the AI the exact, official parish handbook opened to the right page before it speaks. It is only permitted to synthesize an answer from that handbook.

### Technical Architecture
The AI Assistant uses a **Retrieval-Augmented Generation (RAG)** pipeline deployed via **Supabase Edge Functions** and **Google Gemini**:

```
Parishioner asks: "What are the requirements for baptism at San Jose Parish?"
                                │
                                ▼
         [Supabase Edge Function: `church-ai-chat`]
                                │
                                ├─ 1. Vectorize query via Google `gemini-embedding-001`
                                │     (Produces a 768-dimensional float array)
                                │
                                ├─ 2. Vector Cosine Similarity Search in PostgreSQL
                                │     Executes `match_church_knowledge` RPC
                                │     SELECT content FROM church_knowledge_chunks
                                │     WHERE church_id = target_church
                                │     ORDER BY embedding <=> query_embedding LIMIT 5;
                                │
                                ├─ 3. Context Injection into Grounded System Prompt
                                │     System: "You are the Sacralink Parish Assistant for [Church Name]..."
                                │     Context: [Retrieved Database Chunks]
                                │
                                ├─ 4. Generative Inference via Gemini 2.0
                                │     Calls `gemini-2.0-flash-lite`
                                │     (Automatic failover to `gemini-2.0-flash` on rate limit)
                                │
                                └─ 5. Audit Logging to `church_chat_logs`
                                      Returns structured JSON { reply, sourcesUsed }
```

### Knowledge Synchronization (`sync-church-knowledge`)
Admin updates are not automatically indexed one-by-one to avoid unnecessary API costs. When the Church Admin clicks **"Sync AI Knowledge Base"**, the edge function:
1. Queries the church's profile, active Mass schedules, sacrament requirements, and recent announcements.
2. Formats them into standardized textual chunks.
3. Generates 768-dimensional embeddings using `gemini-embedding-001`.
4. Upserts the vectors into `church_knowledge_chunks` with metadata tags (`source_type`, `source_id`).

`<<INSERT IMAGE OF: Church Admin Dashboard AI Sync Status showing Chunks Processed and Timestamp>>`

---

## 4.4 Cashless Donation & Payment Verification Workflow

`<<INSERT IMAGE OF: Donations Verification Page showing Pending, Verified, and Rejected tabs with GCash Reference numbers>>`

### Intuition (Analogy)
Think of cashless donation verification like presenting a bank deposit slip to an accountant. The system displays the parish's official QR code. After sending funds through their banking app, the donor submits the transaction reference number and receipt image. The parish accountant cross-references the slip with their merchant notification before officially marking the contribution as verified.

### Security Architecture & Storage Isolation
1. **Public vs Private Storage Buckets:**
   - Parish GCash/Maya QR codes are stored in the **public** bucket `donation-qr` so all parishioners can scan them.
   - User payment receipt screenshots contain sensitive personal identifiable information (mobile numbers, account names, account balances). They are uploaded to the **private** bucket `donation-proofs`.
2. **Access Control:**  
   - Users can only read proofs matching their own records.
   - Only assigned church staff can view uploaded donation receipts for that parish.
3. **Verification Ledger State Machine:**
   ```
   [PARISHIONER UPLOADS] ──► status: 'pending'
                                    │
                       ┌────────────┴────────────┐
                       ▼                         ▼
            [ADMIN VERIFIES GCASH]     [REFERENCE MISMATCH]
                       │                         │
                       ▼                         ▼
             status: 'verified'         status: 'rejected'
                       │                         │
                       └────────────┬────────────┘
                                    ▼
                     [Realtime Notification Sent to User]
   ```

`<<INSERT IMAGE OF: Donation Proof Inspection Modal showing GCash Transaction Screenshot and Admin Verification Buttons>>`

---

## 4.5 Document Dossier & Client-Side Image Compression

`<<INSERT IMAGE OF: Document Uploader component showing file selection, preview, and requirement checkmarks>>`

### Why Client-Side Compression? (Panelist Justification)
Parishioners often upload multi-megabyte photos of documents taken directly with smartphone cameras (4MB to 12MB each). Uploading uncompressed images causes:
1. High mobile data usage for parishioners.
2. Slow uploads on unstable mobile connections.
3. Rapid exhaustion of Supabase storage quotas.

### Technical Solution
Using `browser-image-compression`, all images are compressed in browser memory **prior to transmission**:
- Maximum file size target: **~200 KB - 500 KB**.
- Automatic dimension resizing while preserving document readability.
- Storage destination: The private bucket `documents`, secured by RLS policies so only the uploading user and assigned church staff can access them.

---

## 4.6 360° Virtual Church Tour: Equirectangular Projections & WebGL

`<<INSERT IMAGE OF: 360° Virtual Church Interior Tour Viewer with navigation controls>>`

### Intuition (Analogy)
Imagine taking a flat world map and projecting it onto an open sphere around your head. As you look around, your browser renders the section of the sphere corresponding to your viewing angle, creating an immersive sense of presence.

### Technical Implementation
- **Component:** `react-photo-sphere-viewer` utilizing Three.js and WebGL.
- **Image Format:** High-resolution **Equirectangular 2:1 ratio** panorama stored in the public `panoramas` Supabase bucket.
- **Performance:** Hardware-accelerated WebGL rendering runs at 60 FPS on standard modern desktop and mobile browsers without requiring third-party plugins.

---

## 4.7 Real-Time Synchronization & Cross-User Notifications

`<<INSERT IMAGE OF: Notification Bell dropdown in header showing appointment update alerts>>`

### The Cross-User RLS Notification Problem & Fix
When an administrator approves an appointment, the system needs to send an in-app notification to the parishioner:
1. The admin executes an `INSERT` into the `notifications` table where `user_id = parishioner_id`.
2. **The Pitfall:** In Supabase, appending `.select()` to an `insert()` query forces a `SELECT` operation. If the table's `SELECT` RLS policy is `auth.uid() = user_id`, PostgreSQL blocks the admin from reading the notification they just created, triggering a `403 Forbidden` error.
3. **The Architectural Fix:** In `src/lib/supabase/notifications.ts`, cross-user notification creation uses **fire-and-forget inserts** without `.select()`. The insert succeeds via permissive insert policies, and the recipient receives the alert via Supabase Realtime WebSocket subscriptions without permissions errors.

## 4.8 Multi-Tier Communication Architecture: Parish Office Tickets & Direct Messaging Matrix

`<<INSERT IMAGE OF: Sacralink Messages View showing Tickets tab, Staff Channel, and 1-on-1 Direct Chats>>`

### Three Architectural Tiers
To balance pastoral confidentiality with administrative responsiveness, Sacralink enforces three distinct communication tiers:

1. **Parish Office Tickets (`conversations` with `is_ticket = true`):**
   - Formal support threads created by parishioners when reaching out to church administration or the diocesan platform.
   - Triaged, assigned, and resolved by Church Admins and Volunteers.
   - Supports escalation to Super Admin and private internal notes hidden from the requester.
2. **Parish Staff Channel:**
   - Dedicated internal room provisioned per parish for assigned clergy, church admins, and volunteers.
3. **1-on-1 Direct Messages (`conversations` with `is_ticket = false`):**
   - Private, confidential dialogue strictly visible only to its two participants (no admin or super admin override).
   - Enforced cryptographically and via database Row-Level Security at the Postgres engine level.

### Direct Message Matrix (Migration 085)

| Initiator Role \ Target Role | `super_admin` | `church_admin` | `priest` | `volunteer` | `user` (Parishioner) |
|:---|:---:|:---:|:---:|:---:|:---:|
| **`super_admin`** | ❌ *(Platform tickets)* | ✅ All Church Admins | ❌ *(Via tickets/admin)* | ❌ *(Platform tickets)* | ❌ *(Platform tickets)* |
| **`church_admin`** | ✅ Direct | ✅ Any Church Admin | ✅ Assigned Church | ✅ Assigned Church | ✅ Assigned Church |
| **`priest`** | ❌ *(Staff channel/ticket)* | ✅ Assigned Church | ❌ *(Staff channel)* | ❌ *(Staff channel)* | ✅ Shared Appointment Only |
| **`volunteer`** | ❌ *(Staff channel/ticket)* | ❌ *(Staff channel/ticket)* | ❌ *(Staff channel)* | ✅ **Any Volunteer (Any Parish)** | ✅ **Any Parishioner (Any Parish)** |
| **`user` (Parishioner)** | ❌ *(Platform ticket)* | ❌ *(Parish office ticket)* | ❌ *(Parish office ticket)* | ✅ **Any Volunteer (Any Parish)** | ✅ **Any Parishioner (Peer-to-Peer)** |


---

# 5. Top 15 Panelist "Trap Questions" & Winning Defense Answers

### Architecture & System Design

#### Q1: "Why did you build a web application for administration instead of doing everything on mobile?"
> **Winning Answer:**  
> Parish administrative workflows involve multi-column data review, reading high-resolution scanned documents, verifying transaction receipts, and bulk scheduling. Conducting these complex administrative tasks on a mobile screen reduces efficiency and increases operator error. By building a desktop-optimized React dashboard for staff and responsive views for parishioners, we tailor each interface to its operational context.

#### Q2: "What is your database concurrency handling mechanism when two parishioners click the same time slot at the same second?"
> **Winning Answer:**  
> We enforce concurrency control at the database transaction layer. Before creating an appointment, our service checks for existing non-cancelled records matching the church, date, and time. Furthermore, PostgreSQL's row-level locking ensures that the first transaction to commit reserves the slot, causing the competing transaction to receive a conflict state and triggering our Haversine recommender.

#### Q3: "What happens if the church internet connection drops during office hours?"
> **Winning Answer:**  
> Sacralink is hosted on cloud infrastructure (Vercel edge network and Supabase managed PostgreSQL). If local parish office internet goes down, incoming parishioner bookings and donations remain safely queued in the cloud database. Once local connectivity resumes, the admin interface synchronizes automatically via Supabase Realtime WebSockets.

---

### Security, Roles & Privacy

#### Q4: "How do you comply with the Philippine Data Privacy Act of 2012 (RA 10173) regarding baptismal and marriage certificates?"
> **Winning Answer:**  
> First, all uploaded sacramental documents are placed in **private, authenticated storage buckets**—not public web directories. Second, Row-Level Security ensures documents are accessible only by the uploading parishioner and authorized parish staff. Third, we enforce the Super Admin blindspot policy: system administrators cannot browse private parishioner documents or local financial ledgers.

#### Q5: "Can a user manipulate their browser's JavaScript or localStorage to elevate their role from 'user' to 'super_admin'?"
> **Winning Answer:**  
> No. While client-side state manages UI rendering, security enforcement occurs on the database server. Every database query passes through Supabase Auth JWT verification and PostgreSQL Row-Level Security policies. Even if a malicious user alters client state, the database evaluates `auth.uid()` against server records and rejects unauthorized actions with a `401 Unauthorized` or `403 Forbidden` error.

#### Q6: "Why did you use SECURITY DEFINER functions in PostgreSQL instead of standard RLS policy checks?"
> **Winning Answer:**  
> Querying the `profiles` table within a `profiles` RLS policy triggers infinite recursion, resulting in database query loops and `500 Internal Server Errors`. Using `SECURITY DEFINER` functions allows the role check to run in a controlled context, bypassing the recursion loop safely while maintaining strict access rules.

---

### Algorithms & Artificial Intelligence

#### Q7: "Why use the Haversine formula instead of the Google Maps Distance Matrix API?"
> **Winning Answer:**  
> The Google Maps Distance Matrix API incurs recurring per-request API costs and depends on third-party availability. The Haversine formula executes mathematically in browser memory in sub-milliseconds with zero API costs, zero quota limits, and zero external network latency, providing instant recommendations to parishioners.

#### Q8: "How do you prevent your AI assistant from hallucinating incorrect Catholic doctrine or false parish fees?"
> **Winning Answer:**  
> We use a Retrieval-Augmented Generation (RAG) architecture. The model is given a strict system prompt instructing it to answer solely based on the retrieved knowledge chunks (`church_knowledge_chunks`). If the information is not present in the indexed context, the model explicitly directs the user to contact the parish office directly, providing the official telephone and email metadata.

#### Q9: "Why did you select Google Gemini 2.0 Flash instead of OpenAI GPT-4o?"
> **Winning Answer:**  
> Gemini 2.0 Flash provides lower inference latency, affordable high-volume execution, and native compatibility with Google's `gemini-embedding-001` (768 dimensions), which integrates cleanly with Supabase `pgvector`. Furthermore, our edge function implements automatic fallback to `gemini-2.0-flash` if quota thresholds are encountered.

---

### Payments & Financial Workflows

#### Q10: "Why didn't you integrate PayMongo or Stripe for automatic payment processing?"
> **Winning Answer:**  
> Formal payment gateway aggregators require parishes to register as corporate commercial entities with merchant banking documentation, which many individual local parishes and mission chapels do not possess. Supporting direct QR Ph, GCash, and Maya uploads accommodates the actual operating model of Philippine parishes with zero transaction fee deductions, while our verification workflow provides full auditability for parish accountants.

#### Q11: "How do you prevent a parishioner from submitting the same GCash reference number multiple times?"
> **Winning Answer:**  
> The database enforces unique indexing on reference numbers per church, and the Church Admin verification interface highlights previously verified or duplicate reference submissions, allowing staff to flag fraudulent entries immediately.

---

### Real-World Operational Feasibility

#### Q12: "How will elderly parish staff who are not tech-savvy learn to use this system?"
> **Winning Answer:**  
> The UI adheres to our "Apple meets The Vatican" design standard: clean, high-contrast typography, large touch targets, minimal visual noise, and clear status badges. Administrative workflows require minimal steps: incoming requests appear on a dashboard where staff can review documents and approve with a single click.

#### Q13: "What is your backup and disaster recovery strategy?"
> **Winning Answer:**  
> Database backups are automated via Supabase with continuous Point-in-Time Recovery (PITR) and daily snapshots. Storage assets (documents, avatars, proof receipts) are distributed across redundant multi-region object storage.

#### Q14: "How does the system handle multi-parish priests who say Mass at different churches?"
> **Winning Answer:**  
> Priests have an independent profile record with an `assigned_church_id` and can be designated as celebrants across appointments. In addition, their `priest_availability` records allow clergy to block out specific dates across churches when attending diocesan retreats or alternate duties.

#### Q15: "What makes SACRALINK significantly better than existing generic booking systems like Calendly or Google Forms?"
> **Winning Answer:**  
> Generic booking systems lack diocesan multi-tenancy, canonical document requirements handling, parish financial privacy boundaries, liturgical celebrant schedules, 360° sacred space virtual tours, and localized RAG AI support. SACRALINK was engineered specifically for the administrative, canonical, and communal realities of Catholic parishes.

---
**End of Comprehensive Defense Guide**
