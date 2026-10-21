# Parish Management Suite: Church Categorization, Manual Parish Verification, Realtime Messaging with Video, and Nearby Parish Recommender

Status: ready-for-agent

## Problem Statement

Diocese administrators, parish staff, and parishioners face several operational and user-experience bottlenecks in the current system:

1. **Staff Oversight & Multi-Parish Categorization**: Diocese Super Admins and Admins have no intuitive way to categorize, filter, or group administrators and volunteers by their assigned parish. The user table displays flat, unorganized lists with raw status indicators rather than clear parish identities.
2. **Parish Onboarding & Donation Fraud Risk**: Creating and verifying churches lacks a structured manual vetting pipeline. Because registered parishes can receive cashless donations via GCash and Maya, unvetted registrations pose an immediate financial and reputation risk without a strict verification process (such as verifying official CBCP/Diocese clergy credentials).
3. **Booking Dead-Ends & Lack of Proactive Alternatives**: When a parishioner attempts to book a sacrament (e.g., Baptism, Wedding) on a date or time that is already filled or where the priest is unavailable, the booking form simply halts without suggesting next available slots at that parish or pointing to nearby parishes in San Jose del Monte (CSJDM) offering the sacrament.
4. **Disjointed Communication**: Parish administrators, priests, volunteers, and parishioners have no direct real-time communication channel or audio/video conference capability within the platform for pre-sacrament interviews, counseling, or staff coordination.
5. **Notification Redundancy**: In-app donation and status notifications suffered from duplicate dispatch calls and redundant green square check emojis (`✅`) that clashed with the platform's visual icon system.

## Solution

A unified Parish Management & Communication Suite that addresses administrative oversight, security, smart booking assistance, and internal communication:

1. **Admin Church Categorization & Multi-Column Sorting**: An enhanced User Management interface providing a "Group by Parish" accordion view, a parish filter dropdown, and multi-column sorting by assigned church, role hierarchy, and full name.
2. **Strict Manual Parish & Clergy Verification System**: A secure onboarding workflow requiring new parish registrants to submit official Catholic Bishops' Conference of the Philippines (CBCP) Clergy ID / Celebret documents and Diocesan Chancery decrees. All cashless donation features and QR displays remain strictly locked in an unverified state until a Diocese Super Admin reviews the credentials and manually verifies the church.
3. **Interactive Parish Map & Cross-Parish Availability Recommender**: OpenStreetMap and Leaflet pin-drop and address geocoding integrated into church management. When a user encounters a booked or conflicting slot, the system uses mathematical distance calculations (Haversine formula) to immediately display two actionable alternative cards: (a) Earliest next available slot at the chosen parish, and (b) Nearest CSJDM parish with open slots on the requested date, complete with 1-click slot selection.
4. **Real-time Messaging & Embedded Audio/Video Conferencing**: A Supabase Realtime-powered chat interface supporting 1-on-1 and parish staff group channels with role badges (Admin, Priest, Volunteer, Parishioner), paired with an embedded, zero-configuration Jitsi Meet conference room modal for audio/video meetings.
5. **Cleaned Notification Pipeline**: Standardized, deduplicated notifications with clean descriptive titles free of emoji glyphs.

## User Stories

### Church Categorization & Staff Management
1. As a Super Admin, I want to filter the user list by assigned parish, so that I can quickly audit all staff assigned to a specific church.
2. As a Super Admin, I want to toggle between a flat table view and a "Group by Parish" accordion view, so that I can see the organizational hierarchy of each parish at a glance.
3. As a Super Admin, I want to see the human-readable parish name for every assigned staff member, so that I don't have to decipher database IDs.
4. As a Super Admin, I want to sort users by assigned church name, role priority, or registration date, so that I can organize user management efficiently.
5. As a Church Admin, I want to view all volunteers and co-admins assigned to my parish, so that I can coordinate parish responsibilities easily.

### Strict Manual Parish Onboarding & Verification
6. As a prospective Parish Priest or Church Admin, I want to submit a formal parish onboarding application with our official parish details, so that our church can be listed on SacraLink.
7. As a prospective Parish Priest, I want to upload my CBCP Clergy ID / Celebret and Diocesan Chancery appointment decree, so that the diocese can verify my authority.
8. As a Diocese Super Admin, I want to view a dedicated queue of pending parish applications with uploaded credentials, so that I can review and verify each applicant thoroughly.
9. As a Diocese Super Admin, I want a verification checklist (including confirming a rectory phone call and verifying the GCash/Maya merchant name matches the parish entity), so that I can prevent donation fraud.
10. As a Diocese Super Admin, I want to approve or reject parish applications with structured notes, so that the applicant receives immediate, formal feedback.
11. As a Parishioner, I want to see a "Verified Parish" badge on legitimate churches, so that I can donate and book sacraments with complete confidence.
12. As a Parishioner, I want unverified churches to have cashless donations disabled, so that fraudulent actors cannot collect money.

### Interactive Map & Smart Booking Recommender
13. As a Church Admin, I want an interactive map with search and pin-dropping when adding or editing our church, so that our precise geographical coordinates are saved accurately without manual copy-pasting.
14. As a Parishioner, I want to select a sacrament type, date, and preferred time on the booking page, so that I can schedule our family sacrament.
15. As a Parishioner, I want the system to immediately detect if my selected slot is unavailable or conflicts with priest availability, so that I do not submit an invalid booking request.
16. As a Parishioner, I want to see the earliest next available slot at my chosen parish when my desired date is full, so that I can easily pick an alternative time at the same church.
17. As a Parishioner, I want to see recommendations for nearby parishes in CSJDM that have open slots on my desired date (with distance in kilometers), so that I can proceed with urgent sacraments (like baptisms or weddings).
18. As a Parishioner, I want a 1-click "Select This Alternative" button on recommendation cards, so that the booking form automatically updates without starting over.

### Real-Time Messaging & Audio/Video Conferencing
19. As a Church Admin, I want to send real-time text messages to parishioners who have submitted appointment requests, so that I can clarify requirement details instantly.
20. As a Parishioner, I want to chat with our parish office in real-time, so that I can ask questions regarding sacrament requirements and schedules.
21. As a Priest, I want to communicate directly with church staff and volunteers in a parish staff channel, so that we can coordinate parish liturgies.
22. As a Church Admin or Priest, I want to initiate an instant audio or video conference meeting from within a chat conversation, so that we can conduct pre-sacrament counseling or wedding interviews.
23. As a meeting participant, I want to join the conference room inside an embedded modal with camera, microphone, and screen-sharing controls, so that I don't need to install external apps or pay for conference software.

### Notifications
24. As a Donor, I want to receive a single, clearly formatted in-app notification when my donation is verified, so that I am confirmed without duplicate alerts.
25. As an Appointment Requester, I want notification titles and messages to display clean text with platform icons rather than redundant square emojis, so that the notification bell UI remains polished and consistent.

## Implementation Decisions

### 1. Administrative Categorization & User Management
- The profile fetching layer will join `churches(id, name)` so that every profile carries its resolved church display name.
- The UI will offer two viewing modes:
  - **Flat Table Mode**: Multi-column sorting (Church Name, Role, Name, Date) with a Church filter dropdown.
  - **Grouped Accordion Mode**: Collapsible cards per church displaying staff counts and itemized role rosters (`Church Admins`, `Volunteers`, `Priests`).
- Church Admins will continue to be scoped strictly to their own assigned parish roster.

### 2. Manual Parish Verification Pipeline & Security State Machine
- A dedicated `parish_applications` data model will track:
  - `applicant_id` (User reference)
  - `parish_name`, `address`, `contact_number`, `email`
  - `celebret_url` (Clergy ID / Celebret document in private storage)
  - `decree_url` (Chancery appointment decree in private storage)
  - `status`: `'pending' | 'under_review' | 'verified_active' | 'rejected'`
  - `reviewed_by`, `reviewed_at`, `rejection_reason`
- A database-level constraint / RLS policy will ensure cashless donation records and public QR displays are restricted to churches whose status is strictly `'verified_active'`.
- Super Admins will have an "Applications" management tab equipped with a verification checklist modal (Landline confirmation, Celebret validation, Merchant name check).

### 3. Geographical Coordinate Storage & Recommender Engine
- Church Add and Edit pages will embed an interactive Leaflet / OpenStreetMap map component that supports text geocoding search and draggable pin-dropping, saving floating-point `latitude` and `longitude`.
- The cross-parish recommender engine will run deterministically using the Haversine distance formula:
  $$\Delta d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
- If a requested slot is unavailable, the engine evaluates active parishes within the diocese offering that sacrament type, checks `mass_schedules` and `priest_availability`, and generates recommendation cards ranked by proximity.

### 4. Real-Time Chat & Embedded Jitsi Conferencing
- The messaging data model will utilize:
  - `conversations` (type: `'direct'` or `'channel'`, `church_id` nullable)
  - `conversation_participants` (`conversation_id`, `user_id`, `last_read_at`)
  - `messages` (`conversation_id`, `sender_id`, `content`, `message_type`: `'text' | 'call_invite'`, `created_at`)
- Subscriptions will use Supabase Realtime channel listeners for instant delivery and unread counts.
- Audio/Video conferencing will leverage the Jitsi Meet IFrame / React SDK embedded in a responsive modal with randomly generated unique meeting room IDs keyed by conversation ID.

### 5. Notification Service Refactor
- All notification generator helpers will enforce clean, un-emojified title strings.
- Redundant notification triggers inside modal action handlers will be removed in favor of single triggers inside the backend data mutation layer.

## Testing Decisions

- **What Makes a Good Test**:
  - Tests must verify observable external user behavior rather than private implementation details.
  - Assert that filtering by church isolates the expected rows.
  - Assert that unverified churches cannot display donation QR codes.
  - Assert that an unavailable booking date triggers the smart alternative cards with valid dates and distances.
  - Assert that real-time message events append to the active chat viewport.
- **Modules to be Tested**:
  - `web/src/pages/admin/UsersPage.tsx` (Filtering, Grouping, Role Sorting)
  - `web/src/pages/appointments/BookAppointmentPage.tsx` (Conflict detection & Alternative recommendation rendering)
  - `web/src/lib/supabase/donations.ts` & `notifications.ts` (Notification dispatch integrity)
  - `web/src/pages/messages/MessagingPage.tsx` (Conversation selection & Message rendering)
- **Prior Art**:
  - Existing component structure in `web/src/components/` and Supabase client integration in `web/src/lib/supabase/`.

## Out of Scope

- Automated AI approval of parish registration requests (strict human manual review is mandatory for anti-fraud security).
- Complete redesign of the parish public/private appointment calendar models (deferred for detailed parish domain research).
- External paid map APIs (Google Maps Platform).
- Self-hosted custom WebRTC media routing servers.

## Further Notes

- All changes will adhere strictly to Tailwind CSS v4 utility classes and Lucide React icon standards.
- Dark mode compatibility and HSL color palette guidelines will be maintained across all newly introduced components.
