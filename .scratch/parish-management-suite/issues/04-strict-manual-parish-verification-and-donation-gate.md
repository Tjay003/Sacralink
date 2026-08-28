# 04 - Strict Manual Parish Verification & Donation Gate

**What to build:**
A secure parish onboarding application workflow where prospective parish admins/priests submit their parish information along with scanned official CBCP Clergy ID / Celebret credentials and Diocesan Chancery appointment decrees. Unverified churches are created with `status: 'unverified'` and have all cashless donation / QR code features strictly locked. Diocese Super Admins have a dedicated review queue with a verification checklist modal (Rectory phone call, Celebret validation, Merchant name check) to manually verify and activate the parish.

**Blocked by:** 01 - Admin Church Categorization & Multi-Column Sorting.

**Status:** ready-for-agent

## Acceptance Criteria
- [ ] Public / Admin parish application submission form with secure file upload for CBCP Clergy ID / Celebret and Chancery decree.
- [ ] New parish applications stored in database with `status: 'pending'`.
- [ ] Churches created with `status: 'unverified'` have donation forms and QR codes locked with a "Verification Pending" banner.
- [ ] Super Admin dashboard displays an "Applications" review queue.
- [ ] Super Admin verification modal includes structured checklist items (Rectory phone call confirmed, Celebret verified, Merchant name matches parish entity).
- [ ] Approving an application sets church status to `verified_active` and unlocks donation capabilities.
- [ ] Rejecting an application records the formal rejection reason and notifies the applicant.
