# 04 - Strict Manual Parish Verification & Donation Gate

**What to build:**
A secure parish onboarding application workflow where prospective parish admins/priests submit their parish information along with scanned official CBCP Clergy ID / Celebret credentials and Diocesan Chancery appointment decrees. Unverified churches are created with `status: 'unverified'` and have all cashless donation / QR code features strictly locked. Diocese Super Admins have a dedicated review queue with a verification checklist modal (Rectory phone call, Celebret validation, Merchant name check) to manually verify and activate the parish.

**Blocked by:** 01 - Admin Church Categorization & Multi-Column Sorting.

**Status:** resolved

## Acceptance Criteria
- [x] Public / Admin parish application submission form with secure file upload for CBCP Clergy ID / Celebret and Chancery decree.
- [x] New parish applications stored in database with `status: 'pending'`.
- [x] Churches created with `status: 'unverified'` have donation forms and QR codes locked with a "Verification Pending" banner.
- [x] Super Admin dashboard displays an "Applications" review queue.
- [x] Super Admin verification modal includes structured checklist items (Rectory phone call confirmed, Celebret verified, Merchant name matches parish entity).
- [x] Approving an application sets church status to `verified_active` and unlocks donation capabilities.
- [x] Rejecting an application records the formal rejection reason and notifies the applicant.

## Resolution
- Created database migration `supabase/migrations/026_create_parish_applications.sql` with `parish_applications` table, RLS policies, and status constraint updates for `churches.status`.
- Updated `web/src/types/database.ts` with `parish_applications` schema types.
- Created `web/src/lib/supabase/parishApplications.ts` API module handling secure document uploads, submissions, super admin review queue queries, and approval/rejection mutations with notification triggers.
- Created `web/src/pages/churches/ApplyParishPage.tsx` with Leaflet coordinate picker integration, clergy credential upload inputs, and submission tracking.
- Created `web/src/pages/admin/ParishApplicationsPage.tsx` with super admin status filters, credential previews, and interactive anti-fraud verification checklist modal.
- Implemented donation gating in `ChurchDetailPage.tsx` and `SubmitDonationModal.tsx` for unverified churches.
- Added comprehensive Playwright test in `web/e2e/parish-verification.spec.ts` (all 47 suite tests passing).
