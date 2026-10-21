# Specification: Priest Assignment & Security Hardening

## 1. Overview
Harden the SacraLink system (Web and Mobile) for production and defense readiness by:
1. **Super Admin Donation Blindspot**: Enforcing strict parish temporal financial privacy by stripping `super_admin` from viewing, mutating, or auditing parish donation records and receipts in both database RLS and Web UI.
2. **Priest Role & Liturgical Assignment**: Supporting both dedicated Clergy (`role = 'priest'`) and Priest-Administrators (`role = 'church_admin'` + `is_priest = true`). Providing an optional Celebrant assignment dropdown and remarks upon appointment approval.
3. **Dedicated Priest Liturgical View**: Introducing `PriestDashboard.tsx` for priests to inspect assigned ceremonies, daily Mass intentions, and parishioner appointments.
4. **Parishioner-to-Priest Messaging Privacy**: Enforcing an Office Gateway pattern where parishioners can only message the Parish Office (`church_admin`), shielding clergy from unsolicited direct messaging.
5. **Abuse Prevention & Rate Limiting**: In-database sliding window for AI chatbot queries (10 msgs / 5 mins), database constraint capping concurrent `pending` bookings per user (max 3), and UI double-submit debouncing.
6. **Cloudflare Turnstile CAPTCHA**: Frictionless bot protection on the user registration form.

---

## 2. Key Architecture Decisions

### 2.1 Super Admin Financial Blindspot
* **Canonical Rationale**: In Catholic Canon Law, parishes are distinct juridic persons administering their own temporal goods via the Parish Priest and Parish Finance Council. A system/software Super Admin is not a diocesan financial auditor.
* **Database RLS**: In `donations` and the `donation-proofs` storage bucket, restrict SELECT/UPDATE strictly to the donor (`user_id = auth.uid()`) and church staff (`church_admin`, `admin` where `church_id = get_current_user_church_id()`). Block `super_admin` completely.
* **UI Isolation**: Remove "Donations" from `DashboardLayout.tsx` for `super_admin`. Add route guards on `/donations` returning a 403 / redirection. Remove monetary revenue widgets from `SuperAdminDashboard.tsx`.

### 2.2 Clergy Identity vs Administrative Permissions
* **Dual-Identity Support**:
  * `profiles.is_priest BOOLEAN DEFAULT false` allows a `church_admin` (Parish Priest running his own parish) to also be recognized as an ordained celebrant.
  * Dedicated `role = 'priest'` for clergy members who celebrate sacraments but do not handle parish desk paperwork.
* **Appointment Approval Seam**:
  * On `AppointmentsPage.tsx`, clicking "Approve" triggers `ApproveAppointmentModal.tsx`.
  * The modal contains an optional Celebrant dropdown displaying active clergy belonging to `appointment.church_id` (`role = 'priest' OR (role = 'church_admin' AND is_priest = true)`) + `"None / Unassigned (Parish Pool)"`.
  * Saves `priest_id` and optional `admin_feedback` on `appointments`.
  * Dispatches an in-app notification to the assigned priest.

### 2.3 Messaging Gateway
* **Office Gateway**: Parishioners can only initiate direct chats with `church_admin` / Parish Office.
* **Clergy Shielding**: Priests do not appear in the parishioner user search/contact directory. Priests can initiate a conversation with a parishioner if assigned to that parishioner's appointment.

### 2.4 Abuse Prevention & Rate Limits
* **AI Chat Sliding Window**: Track timestamps in local session / edge context. Limit to 10 queries per 5 minutes per user/IP. Display pastoral cooldown banner when exceeded.
* **Appointment Spam Constraint**: PostgreSQL trigger / check: Raise exception if user attempts to create a pending appointment when they already have 3 pending appointments.
* **UI Debounce**: Disable submit buttons with loading indicators during in-flight network requests.

### 2.5 Cloudflare Turnstile
* Lightweight integration via `@marsidev/react-turnstile` or script loader on `RegisterPage.tsx`.
* Verifies token before calling `supabase.auth.signUp()`. Gracefully bypassed in demo mode (`isDemoMode`).

---

## 3. Database Migration Sequence
* `034_secure_donations_super_admin_blindspot.sql`: Drop Super Admin access from `donations` and `donation-proofs`.
* `035_add_is_priest_to_profiles.sql`: Add `is_priest BOOLEAN DEFAULT false` to `profiles`.
* `036_restrict_parishioner_direct_messaging.sql`: Restrict `conversations` direct message creation for `role = 'user'`.
* `037_limit_concurrent_pending_appointments.sql`: Prevent users from exceeding 3 concurrent pending bookings.
