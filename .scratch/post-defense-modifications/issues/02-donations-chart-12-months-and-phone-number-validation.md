# 02: Upgrade Donation statistics chart to 12 months with real database aggregation and enforce strict phone/payment number validation

Type: task
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

**What to build:** Fix the hardcoded 6-month donation statistics chart and enforce strict Philippine mobile number limits/validation on church contact and payment channel forms:

1. **12-Month Real Donation Statistics Chart (`DonationsPage.tsx`)**:
   - In `web/src/pages/donations/DonationsPage.tsx`, replace the hardcoded 6-item `realChartData` and `demoChartData` arrays (`May`–`Oct`) with dynamic monthly buckets covering the **Last 12 Months** (e.g. rolling 12 months ending in the current month), plus a **6 Months / 12 Months** range toggle (defaulting to **12 Months**).
   - In `"Real data"` mode, compute **every month's total (`₱Xk` / `₱X`)** from actual verified donations (`status === 'verified'`) fetched from the database for that month (scoped by `church_id` when a church is selected or when logged in as `church_admin`).
   - Update the card subtitle dynamically to reflect `"Giving, last 12 months"` or `"Giving, last 6 months"` based on the active range toggle.
2. **Strict Phone & Payment Number Limits and Validation**:
   - In `web/src/pages/churches/AddChurchPage.tsx` and `web/src/pages/churches/EditChurchPage.tsx`:
     - Enforce strict Philippine mobile number input on `contact_number` (`09XXXXXXXXX` = 11 digits, or `+639XXXXXXXXX` = 13 chars; block arbitrary non-prefix digit strings) and validate on form submit in **both** `AddChurchPage` and `EditChurchPage` so incomplete or invalid numbers (e.g. `"123"`) cannot be saved.
   - In `web/src/components/donations/PaymentChannelModal.tsx`:
     - Enforce numeric-only Philippine mobile formatting (`toMobileDigits` / `maxLength={11}` for `09XXXXXXXXX` or `13` for `+639XXXXXXXXX`) and submit validation on the GCash / Maya account number input so unlimited text or letters cannot be entered.
   - Leave the `Latitude` and `Longitude` coordinate fine-tuning inputs in `ChurchLocationPicker.tsx` untouched.

## Acceptance Criteria
- [ ] `DonationsPage.tsx` defaults to showing **12 months** of giving statistics with a **6M / 12M** toggle, and in `"Real data"` mode every month's bar reflects actual verified donation sums from the database rather than static placeholder values.
- [ ] `AddChurchPage.tsx`, `EditChurchPage.tsx`, and `PaymentChannelModal.tsx` restrict phone/GCash/Maya number inputs to valid Philippine mobile number length and reject invalid/incomplete phone numbers on save.
- [ ] `ChurchLocationPicker.tsx` coordinate number inputs are not modified by this ticket.
- [ ] `tsc -b` and `vite build` pass cleanly.
